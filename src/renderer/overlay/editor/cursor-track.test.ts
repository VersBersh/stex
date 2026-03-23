// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import {
  createEditor,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  $createRangeSelection,
  $isTextNode,
  $isParagraphNode,
  type LexicalEditor,
} from 'lexical';
import { $isCursorAtDocumentEnd, $moveCursorToDocumentEnd } from './cursor-track-utils';

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

function setCursorPosition(editor: LexicalEditor, offset: number): void {
  editor.update(
    () => {
      const root = $getRoot();
      const lastParagraph = root.getLastChild();
      if (!$isParagraphNode(lastParagraph)) return;
      const textNode = lastParagraph.getFirstChild();
      if (!$isTextNode(textNode)) return;

      const selection = $createRangeSelection();
      selection.anchor.set(textNode.getKey(), offset, 'text');
      selection.focus.set(textNode.getKey(), offset, 'text');
      $setSelection(selection);
    },
    { discrete: true },
  );
}

function setCursorAtEnd(editor: LexicalEditor): void {
  editor.update(
    () => {
      const root = $getRoot();
      const lastParagraph = root.getLastChild();
      if (!$isParagraphNode(lastParagraph)) return;
      const lastChild = lastParagraph.getLastChild();

      const selection = $createRangeSelection();
      if ($isTextNode(lastChild)) {
        const offset = lastChild.getTextContentSize();
        selection.anchor.set(lastChild.getKey(), offset, 'text');
        selection.focus.set(lastChild.getKey(), offset, 'text');
      } else {
        const offset = lastParagraph.getChildrenSize();
        selection.anchor.set(lastParagraph.getKey(), offset, 'element');
        selection.focus.set(lastParagraph.getKey(), offset, 'element');
      }
      $setSelection(selection);
    },
    { discrete: true },
  );
}

describe('$isCursorAtDocumentEnd', () => {
  let editor: LexicalEditor;

  afterEach(() => {
    // cleanup
  });

  it('returns true when cursor is at end of single paragraph', () => {
    editor = createTestEditor();
    setEditorText(editor, 'Hello world');
    setCursorAtEnd(editor);

    editor.getEditorState().read(() => {
      expect($isCursorAtDocumentEnd()).toBe(true);
    });
  });

  it('returns false when cursor is mid-document', () => {
    editor = createTestEditor();
    setEditorText(editor, 'Hello world');
    setCursorPosition(editor, 5);

    editor.getEditorState().read(() => {
      expect($isCursorAtDocumentEnd()).toBe(false);
    });
  });

  it('returns false when cursor is at start of document', () => {
    editor = createTestEditor();
    setEditorText(editor, 'Hello world');
    setCursorPosition(editor, 0);

    editor.getEditorState().read(() => {
      expect($isCursorAtDocumentEnd()).toBe(false);
    });
  });

  it('returns true in empty paragraph', () => {
    editor = createTestEditor();
    editor.update(
      () => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        root.append(paragraph);

        const selection = $createRangeSelection();
        selection.anchor.set(paragraph.getKey(), 0, 'element');
        selection.focus.set(paragraph.getKey(), 0, 'element');
        $setSelection(selection);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      expect($isCursorAtDocumentEnd()).toBe(true);
    });
  });

  it('returns false when selection is non-collapsed', () => {
    editor = createTestEditor();
    setEditorText(editor, 'Hello world');

    editor.update(
      () => {
        const root = $getRoot();
        const lastParagraph = root.getLastChild();
        if (!$isParagraphNode(lastParagraph)) return;
        const textNode = lastParagraph.getFirstChild();
        if (!$isTextNode(textNode)) return;

        const selection = $createRangeSelection();
        selection.anchor.set(textNode.getKey(), 0, 'text');
        selection.focus.set(textNode.getKey(), 5, 'text');
        $setSelection(selection);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      expect($isCursorAtDocumentEnd()).toBe(false);
    });
  });

  it('returns false when no selection exists', () => {
    editor = createTestEditor();
    setEditorText(editor, 'Hello');
    editor.update(
      () => {
        $setSelection(null);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      expect($isCursorAtDocumentEnd()).toBe(false);
    });
  });
});

describe('$moveCursorToDocumentEnd', () => {
  let editor: LexicalEditor;

  it('moves cursor to end of text', () => {
    editor = createTestEditor();
    setEditorText(editor, 'Hello world');
    setCursorPosition(editor, 0);

    editor.update(
      () => {
        $moveCursorToDocumentEnd();
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      expect($isCursorAtDocumentEnd()).toBe(true);
      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
      if ($isRangeSelection(selection)) {
        expect(selection.isCollapsed()).toBe(true);
        expect(selection.anchor.offset).toBe(11); // "Hello world".length
      }
    });
  });

  it('works on empty paragraph', () => {
    editor = createTestEditor();
    editor.update(
      () => {
        const root = $getRoot();
        root.clear();
        root.append($createParagraphNode());
      },
      { discrete: true },
    );

    editor.update(
      () => {
        $moveCursorToDocumentEnd();
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      expect($isCursorAtDocumentEnd()).toBe(true);
    });
  });

  it('moves to end of last paragraph in multi-paragraph document', () => {
    editor = createTestEditor();
    editor.update(
      () => {
        const root = $getRoot();
        root.clear();
        const p1 = $createParagraphNode();
        p1.append($createTextNode('First'));
        const p2 = $createParagraphNode();
        p2.append($createTextNode('Second'));
        root.append(p1);
        root.append(p2);
      },
      { discrete: true },
    );

    // Put cursor at start of first paragraph
    editor.update(
      () => {
        const root = $getRoot();
        const firstParagraph = root.getFirstChild();
        if (!$isParagraphNode(firstParagraph)) return;
        const textNode = firstParagraph.getFirstChild();
        if (!$isTextNode(textNode)) return;

        const selection = $createRangeSelection();
        selection.anchor.set(textNode.getKey(), 0, 'text');
        selection.focus.set(textNode.getKey(), 0, 'text');
        $setSelection(selection);
      },
      { discrete: true },
    );

    editor.update(
      () => {
        $moveCursorToDocumentEnd();
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      expect($isCursorAtDocumentEnd()).toBe(true);
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        expect(selection.anchor.offset).toBe(6); // "Second".length
      }
    });
  });

  it('handles empty root (no paragraphs) by creating one', () => {
    editor = createTestEditor();
    editor.update(
      () => {
        const root = $getRoot();
        root.clear();
      },
      { discrete: true },
    );

    editor.update(
      () => {
        $moveCursorToDocumentEnd();
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      expect($isCursorAtDocumentEnd()).toBe(true);
    });
  });

  it('is idempotent when cursor is already at end', () => {
    editor = createTestEditor();
    setEditorText(editor, 'Hello');
    setCursorAtEnd(editor);

    editor.update(
      () => {
        $moveCursorToDocumentEnd();
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      expect($isCursorAtDocumentEnd()).toBe(true);
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        expect(selection.anchor.offset).toBe(5);
      }
    });
  });
});
