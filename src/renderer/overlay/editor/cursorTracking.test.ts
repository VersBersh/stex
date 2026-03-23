// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import {
  createEditor,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $createTextNode,
  $isParagraphNode,
  $isTextNode,
  $setSelection,
  $createRangeSelection,
  type LexicalEditor,
} from 'lexical';
import { $isCursorAtDocumentEnd, $moveCursorToDocumentEnd } from './cursor-track-utils';
import type { SonioxToken } from '../../../shared/types';

function makeToken(text: string): SonioxToken {
  return { text, start_ms: 0, end_ms: 100, confidence: 0.95, is_final: true };
}

function createTestEditor(): LexicalEditor {
  const editor = createEditor({ namespace: 'test', onError: console.error });
  const container = document.createElement('div');
  document.body.appendChild(container);
  container.contentEditable = 'true';
  editor.setRootElement(container);
  return editor;
}

/**
 * Simulates the exact flow from TokenCommitPlugin.onTokensFinal:
 * check cursor position → append text → move cursor if tracking.
 * Returns whether the cursor was at the document end before appending.
 */
function simulateTokenCommit(editor: LexicalEditor, text: string): boolean {
  let cursorAtEnd = true;
  editor.update(
    () => {
      const root = $getRoot();
      const prevSelection = $getSelection();
      const isRange = $isRangeSelection(prevSelection);

      cursorAtEnd = !isRange || $isCursorAtDocumentEnd();

      // Save selection
      const savedAnchorKey = isRange ? prevSelection.anchor.key : null;
      const savedAnchorOffset = isRange ? prevSelection.anchor.offset : 0;
      const savedAnchorType = isRange ? prevSelection.anchor.type : 'text';
      const savedFocusKey = isRange ? prevSelection.focus.key : null;
      const savedFocusOffset = isRange ? prevSelection.focus.offset : 0;
      const savedFocusType = isRange ? prevSelection.focus.type : 'text';

      // Append text
      const lastChild = root.getLastChild();
      if ($isParagraphNode(lastChild)) {
        lastChild.append($createTextNode(text));
      } else {
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(text));
        root.append(paragraph);
      }

      // Update selection
      if (cursorAtEnd) {
        $moveCursorToDocumentEnd();
      } else if (isRange && savedAnchorKey && savedFocusKey) {
        const selection = prevSelection.clone();
        selection.anchor.set(savedAnchorKey, savedAnchorOffset, savedAnchorType);
        selection.focus.set(savedFocusKey, savedFocusOffset, savedFocusType);
        $setSelection(selection);
      }
    },
    { discrete: true, tag: 'historic' },
  );
  return cursorAtEnd;
}

/** Simulates clearEditor from OverlayContext */
function simulateClearEditor(editor: LexicalEditor): void {
  editor.update(
    () => {
      $getRoot().clear();
    },
    { discrete: true },
  );
}

/** Simulates GhostTextPlugin onSessionStart handler */
function simulateSessionStartCursorMove(editor: LexicalEditor): void {
  editor.update(
    () => {
      $moveCursorToDocumentEnd();
    },
    { discrete: true, tag: 'historic' },
  );
}

function getCursorInfo(editor: LexicalEditor): {
  hasSelection: boolean;
  isCollapsed: boolean;
  atEnd: boolean;
  offset: number;
  nodeKey: string;
} {
  let result = { hasSelection: false, isCollapsed: false, atEnd: false, offset: 0, nodeKey: '' };
  editor.getEditorState().read(() => {
    const sel = $getSelection();
    if (!$isRangeSelection(sel)) return;
    result.hasSelection = true;
    result.isCollapsed = sel.isCollapsed();
    result.atEnd = $isCursorAtDocumentEnd();
    result.offset = sel.anchor.offset;
    result.nodeKey = sel.anchor.key;
  });
  return result;
}

function getEditorText(editor: LexicalEditor): string {
  return editor.getEditorState().read(() => $getRoot().getTextContent());
}

function setCursorMidDocument(editor: LexicalEditor, offset: number): void {
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

describe('Cursor tracking integration', () => {
  let editor: LexicalEditor;

  afterEach(() => {
    const root = editor?.getRootElement();
    if (root) {
      document.body.removeChild(root);
      editor.setRootElement(null);
    }
  });

  describe('basic token commit cursor tracking', () => {
    it('cursor tracks to end after first token commit on empty editor', () => {
      editor = createTestEditor();
      simulateSessionStartCursorMove(editor);

      simulateTokenCommit(editor, 'Hello ');

      const cursor = getCursorInfo(editor);
      expect(cursor.hasSelection).toBe(true);
      expect(cursor.atEnd).toBe(true);
      expect(getEditorText(editor)).toBe('Hello ');
    });

    it('cursor tracks across multiple sequential commits', () => {
      editor = createTestEditor();
      simulateSessionStartCursorMove(editor);

      simulateTokenCommit(editor, 'Hello ');
      expect(getCursorInfo(editor).atEnd).toBe(true);

      simulateTokenCommit(editor, 'world ');
      expect(getCursorInfo(editor).atEnd).toBe(true);

      simulateTokenCommit(editor, 'today');
      expect(getCursorInfo(editor).atEnd).toBe(true);

      expect(getEditorText(editor)).toBe('Hello world today');
    });

    it('mid-document cursor is preserved during token commits', () => {
      editor = createTestEditor();
      simulateSessionStartCursorMove(editor);
      simulateTokenCommit(editor, 'Hello world');

      // User places cursor at offset 5 ("Hello|world")
      setCursorMidDocument(editor, 5);
      expect(getCursorInfo(editor).atEnd).toBe(false);

      // More tokens arrive — cursor should stay at offset 5
      simulateTokenCommit(editor, ' today');
      const cursor = getCursorInfo(editor);
      expect(cursor.atEnd).toBe(false);
      expect(cursor.offset).toBe(5);
      expect(getEditorText(editor)).toBe('Hello world today');
    });
  });

  describe('session start with clear (fresh mode)', () => {
    it('BUG REPRO: clear AFTER cursor-move — simulates real React effect order', () => {
      editor = createTestEditor();

      // Simulate the real event order when SESSION_START fires:
      // 1. GhostTextPlugin (child effect, fires first) moves cursor to end
      simulateSessionStartCursorMove(editor);
      // 2. sessionLifecycleController (parent effect, fires second) clears editor
      simulateClearEditor(editor);

      // At this point the selection may be invalid.
      // First token commit should still track cursor to end.
      const wasAtEnd = simulateTokenCommit(editor, 'Hello ');
      expect(wasAtEnd).toBe(true);

      const cursor = getCursorInfo(editor);
      expect(cursor.hasSelection).toBe(true);
      expect(cursor.atEnd).toBe(true);
      expect(getEditorText(editor)).toBe('Hello ');
    });

    it('cursor continues tracking after clear + multiple commits', () => {
      editor = createTestEditor();

      // Session start: child cursor-move first, then parent clear
      simulateSessionStartCursorMove(editor);
      simulateClearEditor(editor);

      simulateTokenCommit(editor, 'One ');
      expect(getCursorInfo(editor).atEnd).toBe(true);

      simulateTokenCommit(editor, 'two ');
      expect(getCursorInfo(editor).atEnd).toBe(true);

      simulateTokenCommit(editor, 'three.');
      expect(getCursorInfo(editor).atEnd).toBe(true);

      expect(getEditorText(editor)).toBe('One two three.');
    });

    it('clear BEFORE cursor-move also works (correct order)', () => {
      editor = createTestEditor();

      // If the ordering were fixed (clear first, then cursor):
      simulateClearEditor(editor);
      simulateSessionStartCursorMove(editor);

      simulateTokenCommit(editor, 'Hello ');
      expect(getCursorInfo(editor).atEnd).toBe(true);
      expect(getEditorText(editor)).toBe('Hello ');
    });
  });

  describe('no selection state', () => {
    it('token commit works when selection is null', () => {
      editor = createTestEditor();

      // Explicitly null out the selection
      editor.update(
        () => { $setSelection(null); },
        { discrete: true },
      );

      const cursor = getCursorInfo(editor);
      expect(cursor.hasSelection).toBe(false);

      // Token commit should treat no-selection as "at end"
      const wasAtEnd = simulateTokenCommit(editor, 'Hello');
      expect(wasAtEnd).toBe(true);

      const afterCursor = getCursorInfo(editor);
      expect(afterCursor.hasSelection).toBe(true);
      expect(afterCursor.atEnd).toBe(true);
    });

    it('subsequent commits track after initial null selection', () => {
      editor = createTestEditor();
      editor.update(
        () => { $setSelection(null); },
        { discrete: true },
      );

      simulateTokenCommit(editor, 'First ');
      simulateTokenCommit(editor, 'second ');
      simulateTokenCommit(editor, 'third.');

      expect(getCursorInfo(editor).atEnd).toBe(true);
      expect(getEditorText(editor)).toBe('First second third.');
    });
  });

  describe('clear mid-session (user clicks Clear button)', () => {
    it('cursor tracks after mid-session clear', () => {
      editor = createTestEditor();
      simulateSessionStartCursorMove(editor);

      // Some transcription arrives
      simulateTokenCommit(editor, 'Hello world');
      expect(getCursorInfo(editor).atEnd).toBe(true);

      // User clicks Clear
      simulateClearEditor(editor);

      // More transcription arrives
      simulateTokenCommit(editor, 'New text');
      expect(getCursorInfo(editor).atEnd).toBe(true);
      expect(getEditorText(editor)).toBe('New text');
    });
  });
});
