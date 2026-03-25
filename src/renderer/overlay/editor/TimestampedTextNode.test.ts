// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { createEditor, $getRoot, $createParagraphNode, type LexicalEditor } from 'lexical';
import {
  TimestampedTextNode,
  $createTimestampedTextNode,
  $isTimestampedTextNode,
  type SerializedTimestampedTextNode,
} from './TimestampedTextNode';

function createTestEditor(): LexicalEditor {
  const editor = createEditor({
    namespace: 'test',
    nodes: [TimestampedTextNode],
    onError: console.error,
  });
  const container = document.createElement('div');
  container.contentEditable = 'true';
  editor.setRootElement(container);
  return editor;
}

describe('TimestampedTextNode', () => {
  let editor: LexicalEditor;

  afterEach(() => {
    const root = editor?.getRootElement();
    if (root) {
      editor.setRootElement(null);
    }
  });

  describe('construction and getters', () => {
    it('stores timestamp metadata', () => {
      editor = createTestEditor();
      editor.update(
        () => {
          const node = $createTimestampedTextNode('Hello ', 100, 500, 'Hello ');
          const paragraph = $createParagraphNode();
          paragraph.append(node);
          $getRoot().append(paragraph);

          expect(node.getStartMs()).toBe(100);
          expect(node.getEndMs()).toBe(500);
          expect(node.getOriginalText()).toBe('Hello ');
          expect(node.getTextContent()).toBe('Hello ');
        },
        { discrete: true },
      );
    });

    it('preserves originalText when text content is changed', () => {
      editor = createTestEditor();
      editor.update(
        () => {
          const node = $createTimestampedTextNode('Hello', 100, 500, 'Hello');
          const paragraph = $createParagraphNode();
          paragraph.append(node);
          $getRoot().append(paragraph);

          node.setTextContent('Hola');
          expect(node.getTextContent()).toBe('Hola');
          expect(node.getOriginalText()).toBe('Hello');
          expect(node.getStartMs()).toBe(100);
          expect(node.getEndMs()).toBe(500);
        },
        { discrete: true },
      );
    });
  });

  describe('getType and clone', () => {
    it('returns correct type', () => {
      expect(TimestampedTextNode.getType()).toBe('timestamped-text');
    });

    it('clone preserves all fields', () => {
      editor = createTestEditor();
      editor.update(
        () => {
          const node = $createTimestampedTextNode('Hi', 200, 400, 'Hi');
          const paragraph = $createParagraphNode();
          paragraph.append(node);
          $getRoot().append(paragraph);

          const cloned = TimestampedTextNode.clone(node);
          expect(cloned.getTextContent()).toBe('Hi');
          const exported = cloned.exportJSON();
          expect(exported.startMs).toBe(200);
          expect(exported.endMs).toBe(400);
          expect(exported.originalText).toBe('Hi');
        },
        { discrete: true },
      );
    });
  });

  describe('type guard', () => {
    it('$isTimestampedTextNode returns true for timestamped nodes', () => {
      editor = createTestEditor();
      editor.update(
        () => {
          const node = $createTimestampedTextNode('test', 0, 100, 'test');
          expect($isTimestampedTextNode(node)).toBe(true);
        },
        { discrete: true },
      );
    });

    it('$isTimestampedTextNode returns false for null/undefined', () => {
      expect($isTimestampedTextNode(null)).toBe(false);
      expect($isTimestampedTextNode(undefined)).toBe(false);
    });
  });

  describe('exportJSON / importJSON', () => {
    it('round-trips through JSON serialization', () => {
      editor = createTestEditor();
      let exported: SerializedTimestampedTextNode | undefined;

      editor.update(
        () => {
          const node = $createTimestampedTextNode('world', 1000, 1500, 'world');
          const paragraph = $createParagraphNode();
          paragraph.append(node);
          $getRoot().append(paragraph);
          exported = node.exportJSON();
        },
        { discrete: true },
      );

      expect(exported).toBeDefined();
      expect(exported!.type).toBe('timestamped-text');
      expect(exported!.startMs).toBe(1000);
      expect(exported!.endMs).toBe(1500);
      expect(exported!.originalText).toBe('world');
      expect(exported!.text).toBe('world');

      // Import and verify
      editor.update(
        () => {
          const imported = TimestampedTextNode.importJSON(exported!);
          expect(imported.getTextContent()).toBe('world');
          const reimported = imported.exportJSON();
          expect(reimported.startMs).toBe(1000);
          expect(reimported.endMs).toBe(1500);
          expect(reimported.originalText).toBe('world');
        },
        { discrete: true },
      );
    });
  });

  describe('DOM rendering', () => {
    it('renders identically to TextNode (as a span)', () => {
      editor = createTestEditor();
      editor.update(
        () => {
          const node = $createTimestampedTextNode('visible text', 0, 100, 'visible text');
          const paragraph = $createParagraphNode();
          paragraph.append(node);
          $getRoot().append(paragraph);
        },
        { discrete: true },
      );

      const rootElement = editor.getRootElement()!;
      const textSpans = rootElement.querySelectorAll('span[data-lexical-text]');
      expect(textSpans.length).toBe(1);
      expect(textSpans[0].textContent).toBe('visible text');
    });
  });

  describe('multiple nodes per paragraph', () => {
    it('appends multiple timestamped nodes in sequence', () => {
      editor = createTestEditor();
      editor.update(
        () => {
          const paragraph = $createParagraphNode();
          paragraph.append($createTimestampedTextNode('Hello ', 0, 500, 'Hello '));
          paragraph.append($createTimestampedTextNode('world', 500, 1000, 'world'));
          $getRoot().append(paragraph);
        },
        { discrete: true },
      );

      const text = editor.getEditorState().read(() => $getRoot().getTextContent());
      expect(text).toBe('Hello world');
    });
  });
});
