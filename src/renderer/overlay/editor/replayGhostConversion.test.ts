// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import {
  createEditor,
  $getRoot,
  $createParagraphNode,
  type LexicalEditor,
} from 'lexical';
import {
  TimestampedTextNode,
  $createTimestampedTextNode,
  $isTimestampedTextNode,
} from './TimestampedTextNode';
import { $convertToReplayGhost } from './replayGhostConversion';

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

/** Helper: build a clean TimestampedTextNode (text === originalText). */
function clean(text: string, startMs: number, endMs: number) {
  return $createTimestampedTextNode(text, startMs, endMs, text);
}

/** Helper: build a dirty TimestampedTextNode (text !== originalText). */
function dirty(currentText: string, originalText: string, startMs: number, endMs: number) {
  return $createTimestampedTextNode(currentText, startMs, endMs, originalText);
}

describe('$convertToReplayGhost', () => {
  let editor: LexicalEditor;

  afterEach(() => {
    const root = editor?.getRootElement();
    if (root) editor.setRootElement(null);
  });

  it('removes clean tail nodes from replayGhostStartMs', () => {
    editor = createTestEditor();
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append(clean('Hello ', 0, 500));
        p.append(dirty('beers', 'bears', 500, 1000));
        p.append(clean(' at', 1000, 1500));
        p.append(clean(' the store', 1500, 2500));
        $getRoot().append(p);
      },
      { discrete: true },
    );

    let result!: ReturnType<typeof $convertToReplayGhost>;
    editor.update(
      () => { result = $convertToReplayGhost(1000); },
      { discrete: true },
    );

    expect(result.ghostText).toBe(' at the store');
    expect(result.removedCharCount).toBe(13);

    // Verify remaining nodes
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const p = root.getFirstChild()!;
      const children = p.getChildren();
      expect(children).toHaveLength(2);
      expect(children[0].getTextContent()).toBe('Hello ');
      expect(children[1].getTextContent()).toBe('beers');
    });
  });

  it('suffix-match: truncates dirty node and folds suffix into ghost', () => {
    editor = createTestEditor();
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append(clean('Hello ', 0, 500));
        // User prepended "cold " to "beers" → "cold beers" (suffix match)
        p.append(dirty('cold beers', 'beers', 500, 1000));
        p.append(clean(' at the store', 1000, 2000));
        $getRoot().append(p);
      },
      { discrete: true },
    );

    let result!: ReturnType<typeof $convertToReplayGhost>;
    editor.update(
      () => { result = $convertToReplayGhost(500); },
      { discrete: true },
    );

    expect(result.ghostText).toBe('beers at the store');
    expect(result.removedCharCount).toBe(18);

    // Verify remaining nodes: "Hello " + "cold "
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const p = root.getFirstChild()!;
      const children = p.getChildren();
      expect(children).toHaveLength(2);
      expect(children[0].getTextContent()).toBe('Hello ');
      expect(children[1].getTextContent()).toBe('cold ');
      // The truncated node should still be a TimestampedTextNode
      expect($isTimestampedTextNode(children[1])).toBe(true);
    });
  });

  it('no nodes to remove: returns empty result', () => {
    editor = createTestEditor();
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append(clean('Hello', 0, 500));
        $getRoot().append(p);
      },
      { discrete: true },
    );

    let result!: ReturnType<typeof $convertToReplayGhost>;
    editor.update(
      () => { result = $convertToReplayGhost(1000); },
      { discrete: true },
    );

    expect(result.ghostText).toBe('');
    expect(result.removedCharCount).toBe(0);

    // Editor unchanged
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const p = root.getFirstChild()!;
      expect(p.getChildren()).toHaveLength(1);
      expect(p.getTextContent()).toBe('Hello');
    });
  });

  it('all clean nodes removed', () => {
    editor = createTestEditor();
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append(clean('Hello ', 0, 500));
        p.append(clean('world', 500, 1000));
        $getRoot().append(p);
      },
      { discrete: true },
    );

    let result!: ReturnType<typeof $convertToReplayGhost>;
    editor.update(
      () => { result = $convertToReplayGhost(0); },
      { discrete: true },
    );

    expect(result.ghostText).toBe('Hello world');
    expect(result.removedCharCount).toBe(11);
  });

  it('empty editor returns empty result', () => {
    editor = createTestEditor();

    let result!: ReturnType<typeof $convertToReplayGhost>;
    editor.update(
      () => { result = $convertToReplayGhost(0); },
      { discrete: true },
    );

    expect(result.ghostText).toBe('');
    expect(result.removedCharCount).toBe(0);
  });

  it('multiple clean tail nodes', () => {
    editor = createTestEditor();
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append(dirty('x', 'y', 0, 100));
        p.append(clean(' a', 100, 200));
        p.append(clean(' b', 200, 300));
        p.append(clean(' c', 300, 400));
        $getRoot().append(p);
      },
      { discrete: true },
    );

    let result!: ReturnType<typeof $convertToReplayGhost>;
    editor.update(
      () => { result = $convertToReplayGhost(100); },
      { discrete: true },
    );

    expect(result.ghostText).toBe(' a b c');
    expect(result.removedCharCount).toBe(6);

    // Only dirty("x") remains
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const p = root.getFirstChild()!;
      const children = p.getChildren();
      expect(children).toHaveLength(1);
      expect(children[0].getTextContent()).toBe('x');
    });
  });

  it('non-suffix-match dirty node at replayGhostStartMs stays', () => {
    editor = createTestEditor();
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append(clean('Hello ', 0, 500));
        // "beers" doesn't end with "bears" — non-suffix-match
        p.append(dirty('beers', 'bears', 500, 1000));
        p.append(clean(' world', 1000, 2000));
        $getRoot().append(p);
      },
      { discrete: true },
    );

    // Start at the clean node's time (1000), not the dirty node's time
    let result!: ReturnType<typeof $convertToReplayGhost>;
    editor.update(
      () => { result = $convertToReplayGhost(1000); },
      { discrete: true },
    );

    expect(result.ghostText).toBe(' world');
    expect(result.removedCharCount).toBe(6);

    // dirty("beers") remains
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const p = root.getFirstChild()!;
      const children = p.getChildren();
      expect(children).toHaveLength(2);
      expect(children[0].getTextContent()).toBe('Hello ');
      expect(children[1].getTextContent()).toBe('beers');
    });
  });

  it('round-trip: identical text is correctly ghosted and can be re-committed', () => {
    editor = createTestEditor();
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append(clean('Hello ', 0, 500));
        p.append(clean('world', 500, 1000));
        $getRoot().append(p);
      },
      { discrete: true },
    );

    // Convert tail to ghost
    let result!: ReturnType<typeof $convertToReplayGhost>;
    editor.update(
      () => { result = $convertToReplayGhost(500); },
      { discrete: true },
    );

    expect(result.ghostText).toBe('world');
    expect(result.removedCharCount).toBe(5);

    // Re-commit the same text as a new TimestampedTextNode
    editor.update(
      () => {
        const root = $getRoot();
        const p = root.getFirstChild()!;
        p.append($createTimestampedTextNode('world', 500, 1000, 'world'));
      },
      { discrete: true, tag: 'historic' },
    );

    // Verify final state matches original
    editor.getEditorState().read(() => {
      const root = $getRoot();
      expect(root.getTextContent()).toBe('Hello world');
    });
  });
});
