// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import {
  createEditor,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  type LexicalEditor,
} from 'lexical';
import {
  TimestampedTextNode,
  $createTimestampedTextNode,
} from './TimestampedTextNode';
import {
  $analyzeReplayEligibility,
  PROXIMITY_THRESHOLD_CHARS,
} from './analyzeReplayEligibility';

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

describe('$analyzeReplayEligibility', () => {
  let editor: LexicalEditor;

  afterEach(() => {
    const root = editor?.getRootElement();
    if (root) editor.setRootElement(null);
  });

  function analyze() {
    let result!: ReturnType<typeof $analyzeReplayEligibility>;
    editor.getEditorState().read(() => {
      result = $analyzeReplayEligibility();
    });
    return result;
  }

  it('returns ineligible with blockedReason "none" when no dirty nodes exist', () => {
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

    const result = analyze();
    expect(result.eligible).toBe(false);
    expect(result.blockedReason).toBe('none');
    expect(result.replayStartMs).toBeNull();
    expect(result.replayGhostStartMs).toBeNull();
  });

  it('returns eligible when dirty node near end has clean tail in same paragraph', () => {
    editor = createTestEditor();
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append(clean('I bought some ', 0, 1000));
        // User corrected "bears" → "beers" (dirty, non-suffix-match)
        p.append(dirty('beers', 'bears', 1000, 1500));
        p.append(clean(' at the store', 1500, 2500));
        $getRoot().append(p);
      },
      { discrete: true },
    );

    const result = analyze();
    expect(result.eligible).toBe(true);
    expect(result.blockedReason).toBe('none');
    // Non-suffix-match → replayStartMs is first clean node after dirty
    expect(result.replayStartMs).toBe(1500);
    expect(result.replayGhostStartMs).toBe(1500);
  });

  it('returns ineligible with "too-far-from-end" when dirty node is >100 chars from end', () => {
    editor = createTestEditor();
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append(dirty('edited', 'original', 0, 500));
        // Add >100 chars of clean text after the dirty node
        const longText = 'a'.repeat(PROXIMITY_THRESHOLD_CHARS + 1);
        p.append(clean(longText, 500, 10000));
        $getRoot().append(p);
      },
      { discrete: true },
    );

    const result = analyze();
    expect(result.eligible).toBe(false);
    expect(result.blockedReason).toBe('too-far-from-end');
  });

  it('returns ineligible with "dirty-tail" when dirty node is at doc end (no clean tail)', () => {
    editor = createTestEditor();
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append(clean('Hello ', 0, 500));
        p.append(dirty('edited', 'world', 500, 1000));
        $getRoot().append(p);
      },
      { discrete: true },
    );

    const result = analyze();
    expect(result.eligible).toBe(false);
    expect(result.blockedReason).toBe('dirty-tail');
  });

  it('returns ineligible with "paragraph-boundary" when dirty node and clean tail are in different paragraphs', () => {
    editor = createTestEditor();
    editor.update(
      () => {
        const p1 = $createParagraphNode();
        p1.append(dirty('beers', 'bears', 1000, 1500));
        $getRoot().append(p1);

        const p2 = $createParagraphNode();
        p2.append(clean('New paragraph text', 1500, 3000));
        $getRoot().append(p2);
      },
      { discrete: true },
    );

    const result = analyze();
    expect(result.eligible).toBe(false);
    expect(result.blockedReason).toBe('paragraph-boundary');
  });

  it('uses dirty node startMs for suffix-match case', () => {
    editor = createTestEditor();
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append(clean('I bought some ', 0, 1000));
        // User prepended "cold " to "beers" → "cold beers" (suffix-match: endsWith("beers"))
        p.append(dirty('cold beers', 'beers', 1000, 1500));
        p.append(clean(' at the store', 1500, 2500));
        $getRoot().append(p);
      },
      { discrete: true },
    );

    const result = analyze();
    expect(result.eligible).toBe(true);
    expect(result.replayStartMs).toBe(1000); // dirty node's own startMs
    expect(result.replayGhostStartMs).toBe(1000); // includes dirty node's suffix
  });

  it('uses first clean node startMs for non-suffix-match case', () => {
    editor = createTestEditor();
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append(clean('I bought some ', 0, 1000));
        // User changed "bears" → "beers" (no suffix match: "beers" doesn't end with "bears")
        p.append(dirty('beers', 'bears', 1000, 1500));
        p.append(clean(' at the store', 1500, 2500));
        $getRoot().append(p);
      },
      { discrete: true },
    );

    const result = analyze();
    expect(result.eligible).toBe(true);
    expect(result.replayStartMs).toBe(1500); // first clean node's startMs
    expect(result.replayGhostStartMs).toBe(1500);
  });

  it('handles plain TextNode (user-typed) as dirty node', () => {
    editor = createTestEditor();
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append(clean('Hello ', 0, 500));
        // User typed new content (plain TextNode, no timestamps)
        p.append($createTextNode('typed '));
        p.append(clean('world', 500, 1000));
        $getRoot().append(p);
      },
      { discrete: true },
    );

    const result = analyze();
    expect(result.eligible).toBe(true);
    // Plain TextNode → non-suffix-match path → uses first clean node after dirty
    expect(result.replayStartMs).toBe(500);
    expect(result.replayGhostStartMs).toBe(500);
  });

  it('proximity gate: exactly 100 chars of clean tail is eligible', () => {
    editor = createTestEditor();
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append(dirty('x', 'y', 0, 100));
        p.append(clean('a'.repeat(100), 100, 5000));
        $getRoot().append(p);
      },
      { discrete: true },
    );

    const result = analyze();
    expect(result.eligible).toBe(true);
  });

  it('proximity gate: 101 chars of clean tail is too far', () => {
    editor = createTestEditor();
    editor.update(
      () => {
        const p = $createParagraphNode();
        p.append(dirty('x', 'y', 0, 100));
        p.append(clean('a'.repeat(101), 100, 5000));
        $getRoot().append(p);
      },
      { discrete: true },
    );

    const result = analyze();
    expect(result.eligible).toBe(false);
    expect(result.blockedReason).toBe('too-far-from-end');
  });

  it('proximity gate counts paragraph separators toward distance', () => {
    // Proximity fires before paragraph-boundary guard when the dirty node
    // is far from the end. Set up: dirty node in p1, clean tail split across
    // p1 and p2 with total leaf chars = 99 but + 2 (\n\n separator) = 101.
    // The proximity gate fires at >100, returning 'too-far-from-end' before
    // the paragraph-boundary guard has a chance to fire.
    editor = createTestEditor();
    editor.update(
      () => {
        const p1 = $createParagraphNode();
        p1.append(dirty('x', 'y', 0, 100));
        p1.append(clean('a'.repeat(98), 100, 5000));
        $getRoot().append(p1);

        const p2 = $createParagraphNode();
        p2.append(clean('b', 5000, 5100));
        $getRoot().append(p2);
        // Total distance: 98 leaf chars + 2 (\n\n) + 1 leaf char = 101
      },
      { discrete: true },
    );

    const result = analyze();
    expect(result.eligible).toBe(false);
    expect(result.blockedReason).toBe('too-far-from-end');
  });

  it('returns ineligible with "none" for empty editor', () => {
    editor = createTestEditor();
    // Editor starts with an empty paragraph by default after setRootElement

    const result = analyze();
    expect(result.eligible).toBe(false);
    expect(result.blockedReason).toBe('none');
  });

  it('handles suffix-match where currentText equals originalText (clean node)', () => {
    // Edge case: this shouldn't happen (clean nodes aren't dirty) but verify
    // the algorithm handles it — the node wouldn't be selected as dirty.
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

    const result = analyze();
    expect(result.eligible).toBe(false);
    expect(result.blockedReason).toBe('none');
  });

  it('picks the latest dirty node when multiple dirty nodes exist', () => {
    editor = createTestEditor();
    editor.update(
      () => {
        const p = $createParagraphNode();
        // Early dirty node (far from end)
        p.append(dirty('changed1', 'orig1', 0, 500));
        p.append(clean('some clean text in between here ', 500, 1500));
        // Late dirty node (near end)
        p.append(dirty('changed2', 'orig2', 1500, 2000));
        p.append(clean(' tail', 2000, 2500));
        $getRoot().append(p);
      },
      { discrete: true },
    );

    const result = analyze();
    expect(result.eligible).toBe(true);
    // Should use the latest dirty node (changed2), not the first one
    expect(result.replayStartMs).toBe(2000); // first clean after latest dirty
    expect(result.replayGhostStartMs).toBe(2000);
  });
});
