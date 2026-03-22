// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createEditor,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  $isParagraphNode,
  $isTextNode,
  type LexicalEditor,
} from 'lexical';
import { createEditorBlockManager, type EditorBlockManager } from './editorBlockManager';
import { registerInlineEditListener } from './InlineEditPlugin';
import { registerUserTypingListener } from './UserTypingPlugin';
import type { SonioxToken } from '../../../shared/types';

function makeToken(text: string): SonioxToken {
  return { text, start_ms: 0, end_ms: 100, confidence: 0.95, is_final: true };
}

function createTestEditor(): LexicalEditor {
  const editor = createEditor({ namespace: 'test', onError: console.error });
  const container = document.createElement('div');
  editor.setRootElement(container);
  return editor;
}

function setEditorText(editor: LexicalEditor, text: string): void {
  editor.update(
    () => {
      const root = $getRoot();
      root.clear();
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(text));
      root.append(paragraph);
    },
    { discrete: true },
  );
}

function getEditorText(editor: LexicalEditor): string {
  return editor.getEditorState().read(() => $getRoot().getTextContent());
}

function splitParagraphAt(editor: LexicalEditor, paragraphIndex: number, textOffset: number): void {
  editor.update(
    () => {
      const root = $getRoot();
      const children = root.getChildren();
      const paragraph = children[paragraphIndex];
      if (!$isParagraphNode(paragraph)) throw new Error(`Child ${paragraphIndex} is not a paragraph`);

      // Find the text node and offset within it
      let remaining = textOffset;
      const textChildren = paragraph.getChildren();
      for (const child of textChildren) {
        if (!$isTextNode(child)) continue;
        const len = child.getTextContentSize();
        if (remaining <= len) {
          // Split this text node
          const [, after] = child.splitText(remaining);
          if (after) {
            const newParagraph = $createParagraphNode();
            // Move 'after' and all subsequent siblings to new paragraph
            let sibling: typeof after | null = after;
            while (sibling) {
              const next = sibling.getNextSibling();
              newParagraph.append(sibling);
              sibling = next;
            }
            paragraph.insertAfter(newParagraph);
          } else {
            // Split at end of text node — create empty new paragraph
            const newParagraph = $createParagraphNode();
            paragraph.insertAfter(newParagraph);
          }
          return;
        }
        remaining -= len;
      }

      // textOffset is at or beyond end — create empty paragraph after
      const newParagraph = $createParagraphNode();
      paragraph.insertAfter(newParagraph);
    },
    { discrete: true },
  );
}

function joinParagraphs(editor: LexicalEditor, firstParagraphIndex: number): void {
  editor.update(
    () => {
      const root = $getRoot();
      const children = root.getChildren();
      const first = children[firstParagraphIndex];
      const second = children[firstParagraphIndex + 1];
      if (!$isParagraphNode(first) || !$isParagraphNode(second)) {
        throw new Error('Expected two consecutive paragraphs');
      }

      const secondChildren = second.getChildren();
      for (const child of secondChildren) {
        first.append(child);
      }
      second.remove();
    },
    { discrete: true },
  );
}

function typeAtEnd(editor: LexicalEditor, text: string): void {
  editor.update(
    () => {
      const root = $getRoot();
      const lastChild = root.getLastChild();
      if (!$isParagraphNode(lastChild)) throw new Error('No paragraph found');
      const lastText = lastChild.getLastChild();
      if ($isTextNode(lastText)) {
        lastText.setTextContent(lastText.getTextContent() + text);
      } else {
        lastChild.append($createTextNode(text));
      }
    },
    { discrete: true },
  );
}

function insertInParagraph(
  editor: LexicalEditor,
  paragraphIndex: number,
  offset: number,
  text: string,
): void {
  editor.update(
    () => {
      const root = $getRoot();
      const paragraph = root.getChildren()[paragraphIndex];
      if (!$isParagraphNode(paragraph)) throw new Error('Not a paragraph');
      const textNode = paragraph.getFirstChild();
      if ($isTextNode(textNode)) {
        const content = textNode.getTextContent();
        textNode.setTextContent(content.slice(0, offset) + text + content.slice(offset));
      } else {
        paragraph.append($createTextNode(text));
      }
    },
    { discrete: true },
  );
}

function deleteInParagraph(
  editor: LexicalEditor,
  paragraphIndex: number,
  offset: number,
  count: number,
): void {
  editor.update(
    () => {
      const root = $getRoot();
      const paragraph = root.getChildren()[paragraphIndex];
      if (!$isParagraphNode(paragraph)) throw new Error('Not a paragraph');
      const textNode = paragraph.getFirstChild();
      if ($isTextNode(textNode)) {
        const content = textNode.getTextContent();
        textNode.setTextContent(content.slice(0, offset) + content.slice(offset + count));
      }
    },
    { discrete: true },
  );
}

type ListenerOrder = 'inline-first' | 'typing-first';

function registerListeners(
  editor: LexicalEditor,
  blockManager: EditorBlockManager,
  order: ListenerOrder,
): (() => void)[] {
  if (order === 'inline-first') {
    return [
      registerInlineEditListener(editor, blockManager),
      registerUserTypingListener(editor, blockManager),
    ];
  }
  return [
    registerUserTypingListener(editor, blockManager),
    registerInlineEditListener(editor, blockManager),
  ];
}

describe('Multi-paragraph integration (Lexical + plugins)', () => {
  let editor: LexicalEditor;
  let blockManager: EditorBlockManager;
  let cleanups: (() => void)[];

  function setup(order: ListenerOrder = 'inline-first') {
    editor = createTestEditor();
    blockManager = createEditorBlockManager();
    cleanups = registerListeners(editor, blockManager, order);
  }

  afterEach(() => {
    cleanups?.forEach((fn) => fn());
  });

  describe('paragraph split', () => {
    beforeEach(() => setup());

    it('split at mid-point produces \\n\\n in block text', () => {
      setEditorText(editor, 'Hello world');
      // Sync block manager with initial text
      expect(blockManager.getDocumentText()).toBe('Hello world');

      splitParagraphAt(editor, 0, 5);

      const editorText = getEditorText(editor);
      expect(editorText).toBe('Hello\n\n world');
      expect(blockManager.getDocumentText()).toBe(editorText);
    });

    it('split at end of text creates tail block with \\n\\n', () => {
      setEditorText(editor, 'Hello world');
      expect(blockManager.getDocumentText()).toBe('Hello world');

      splitParagraphAt(editor, 0, 11);

      const editorText = getEditorText(editor);
      expect(editorText).toBe('Hello world\n\n');
      expect(blockManager.getDocumentText()).toBe(editorText);

      const blocks = blockManager.getBlocks();
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      // Tail split creates a user block containing \n\n
      const lastBlock = blocks[blocks.length - 1];
      expect(lastBlock.source).toBe('user');
      expect(lastBlock.text).toContain('\n\n');
    });

    it('typing in second paragraph after split extends correctly', () => {
      setEditorText(editor, 'Hello world');
      expect(blockManager.getDocumentText()).toBe('Hello world');

      splitParagraphAt(editor, 0, 5);
      expect(blockManager.getDocumentText()).toBe('Hello\n\n world');

      typeAtEnd(editor, '!');

      const editorText = getEditorText(editor);
      expect(editorText).toBe('Hello\n\n world!');
      expect(blockManager.getDocumentText()).toBe(editorText);
    });

    it('multiple sequential splits maintain consistent offsets', () => {
      setEditorText(editor, 'ABCDEF');
      expect(blockManager.getDocumentText()).toBe('ABCDEF');

      // Split after 'AB' → "AB\n\nCDEF"
      splitParagraphAt(editor, 0, 2);
      expect(blockManager.getDocumentText()).toBe(getEditorText(editor));

      // Split second paragraph after 'CD' → "AB\n\nCD\n\nEF"
      splitParagraphAt(editor, 1, 2);
      const editorText = getEditorText(editor);
      expect(editorText).toBe('AB\n\nCD\n\nEF');
      expect(blockManager.getDocumentText()).toBe(editorText);

      // Verify block-level state: all \n\n separators embedded in block text
      const blocks = blockManager.getBlocks();
      const combinedText = blocks.map((b) => b.text).join('');
      expect(combinedText).toBe('AB\n\nCD\n\nEF');
    });
  });

  describe('paragraph join', () => {
    beforeEach(() => setup());

    it('joining two paragraphs removes \\n\\n', () => {
      setEditorText(editor, 'Hello world');
      splitParagraphAt(editor, 0, 5);
      expect(getEditorText(editor)).toBe('Hello\n\n world');

      joinParagraphs(editor, 0);

      const editorText = getEditorText(editor);
      expect(editorText).toBe('Hello world');
      expect(blockManager.getDocumentText()).toBe(editorText);
    });

    it('join after typing in second paragraph combines text', () => {
      setEditorText(editor, 'Hello');
      splitParagraphAt(editor, 0, 5);
      typeAtEnd(editor, 'world');
      expect(getEditorText(editor)).toBe('Hello\n\nworld');

      joinParagraphs(editor, 0);

      const editorText = getEditorText(editor);
      expect(editorText).toBe('Helloworld');
      expect(blockManager.getDocumentText()).toBe(editorText);
    });

    it('join then re-split recovers correct offsets', () => {
      setEditorText(editor, 'Hello world');
      splitParagraphAt(editor, 0, 5);
      joinParagraphs(editor, 0);
      expect(blockManager.getDocumentText()).toBe('Hello world');

      splitParagraphAt(editor, 0, 6);
      const editorText = getEditorText(editor);
      expect(editorText).toBe('Hello \n\nworld');
      expect(blockManager.getDocumentText()).toBe(editorText);

      // Verify block text contains the \n\n at the right position
      const blocks = blockManager.getBlocks();
      const combinedText = blocks.map((b) => b.text).join('');
      expect(combinedText).toBe('Hello \n\nworld');
    });
  });

  describe('block manager consistency after token commits', () => {
    beforeEach(() => setup());

    it('paragraph split after token commit maintains correct state', () => {
      // Commit tokens directly to block manager (simulates Soniox transcription)
      blockManager.commitFinalTokens([makeToken('Hello world')]);
      // Set matching text in editor
      setEditorText(editor, 'Hello world');

      splitParagraphAt(editor, 0, 5);

      const editorText = getEditorText(editor);
      expect(editorText).toBe('Hello\n\n world');
      expect(blockManager.getDocumentText()).toBe(editorText);
      expect(blockManager.getBlocks()[0].source).toBe('soniox');
      expect(blockManager.getBlocks()[0].modified).toBe(true);
    });

    it('typing after token commit + split creates consistent blocks', () => {
      blockManager.commitFinalTokens([makeToken('Hello world')]);
      setEditorText(editor, 'Hello world');

      // Split at end
      splitParagraphAt(editor, 0, 11);
      expect(blockManager.getDocumentText()).toBe('Hello world\n\n');

      // Type in second paragraph
      typeAtEnd(editor, 'more');

      const editorText = getEditorText(editor);
      expect(editorText).toBe('Hello world\n\nmore');
      expect(blockManager.getDocumentText()).toBe(editorText);

      // Verify block structure: soniox block + user block with \n\n prefix
      const blocks = blockManager.getBlocks();
      expect(blocks.length).toBeGreaterThanOrEqual(2);
      expect(blocks[0].source).toBe('soniox');
      const lastBlock = blocks[blocks.length - 1];
      expect(lastBlock.source).toBe('user');
      expect(lastBlock.text).toContain('more');
    });

    it('subsequent token commit after paragraph changes is consistent', () => {
      blockManager.commitFinalTokens([makeToken('Hello world')]);
      setEditorText(editor, 'Hello world');

      splitParagraphAt(editor, 0, 5);
      expect(blockManager.getDocumentText()).toBe('Hello\n\n world');

      // Mid-doc split marks original soniox block as modified
      expect(blockManager.getBlocks()[0].source).toBe('soniox');
      expect(blockManager.getBlocks()[0].modified).toBe(true);

      // Simulate new tokens arriving (direct block manager call)
      blockManager.commitFinalTokens([makeToken(' today')]);
      expect(blockManager.getDocumentText()).toBe('Hello\n\n world today');

      // New tokens create a separate soniox block (since first is modified)
      const blocks = blockManager.getBlocks();
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toMatchObject({ source: 'soniox', modified: true });
      expect(blocks[1]).toMatchObject({ source: 'soniox', modified: false, text: ' today' });
    });
  });

  describe('listener execution order', () => {
    it('inline-first: paragraph split at end produces correct state', () => {
      setup('inline-first');
      setEditorText(editor, 'Hello world');

      splitParagraphAt(editor, 0, 11);

      const editorText = getEditorText(editor);
      expect(editorText).toBe('Hello world\n\n');
      expect(blockManager.getDocumentText()).toBe(editorText);
    });

    it('typing-first: paragraph split at end produces identical state', () => {
      setup('typing-first');
      setEditorText(editor, 'Hello world');

      splitParagraphAt(editor, 0, 11);

      const editorText = getEditorText(editor);
      expect(editorText).toBe('Hello world\n\n');
      expect(blockManager.getDocumentText()).toBe(editorText);
    });

    it('both orders converge for tail typing after split', () => {
      const results: string[] = [];

      for (const order of ['inline-first', 'typing-first'] as const) {
        const ed = createTestEditor();
        const bm = createEditorBlockManager();
        const cl = registerListeners(ed, bm, order);

        setEditorText(ed, 'Hello');
        splitParagraphAt(ed, 0, 5);
        typeAtEnd(ed, 'world');

        results.push(bm.getDocumentText());
        const editorText = getEditorText(ed);
        expect(bm.getDocumentText()).toBe(editorText);

        cl.forEach((fn) => fn());
      }

      expect(results[0]).toBe(results[1]);
      expect(results[0]).toBe('Hello\n\nworld');
    });

    it('both orders converge for mid-document split', () => {
      const results: string[] = [];

      for (const order of ['inline-first', 'typing-first'] as const) {
        const ed = createTestEditor();
        const bm = createEditorBlockManager();
        const cl = registerListeners(ed, bm, order);

        setEditorText(ed, 'Hello world');
        splitParagraphAt(ed, 0, 5);

        results.push(bm.getDocumentText());
        const editorText = getEditorText(ed);
        expect(bm.getDocumentText()).toBe(editorText);

        cl.forEach((fn) => fn());
      }

      expect(results[0]).toBe(results[1]);
      expect(results[0]).toBe('Hello\n\n world');
    });

    it('both orders converge for paragraph join', () => {
      const results: string[] = [];

      for (const order of ['inline-first', 'typing-first'] as const) {
        const ed = createTestEditor();
        const bm = createEditorBlockManager();
        const cl = registerListeners(ed, bm, order);

        setEditorText(ed, 'Hello world');
        splitParagraphAt(ed, 0, 5);
        joinParagraphs(ed, 0);

        results.push(bm.getDocumentText());
        const editorText = getEditorText(ed);
        expect(bm.getDocumentText()).toBe(editorText);

        cl.forEach((fn) => fn());
      }

      expect(results[0]).toBe(results[1]);
      expect(results[0]).toBe('Hello world');
    });

    it('both orders converge for token commit + split + typing', () => {
      const results: string[] = [];

      for (const order of ['inline-first', 'typing-first'] as const) {
        const ed = createTestEditor();
        const bm = createEditorBlockManager();
        const cl = registerListeners(ed, bm, order);

        bm.commitFinalTokens([makeToken('Hello world')]);
        setEditorText(ed, 'Hello world');

        splitParagraphAt(ed, 0, 11);
        typeAtEnd(ed, 'more');

        results.push(bm.getDocumentText());
        const editorText = getEditorText(ed);
        expect(bm.getDocumentText()).toBe(editorText);

        cl.forEach((fn) => fn());
      }

      expect(results[0]).toBe(results[1]);
      expect(results[0]).toBe('Hello world\n\nmore');
    });
  });
});
