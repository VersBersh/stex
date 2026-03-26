import { $getRoot, $isParagraphNode, $isTextNode, type TextNode } from 'lexical';
import { $isTimestampedTextNode } from './TimestampedTextNode';
import { LEXICAL_PARAGRAPH_SEPARATOR } from './lexicalTextContract';
import type { ReplayAnalysisResult } from '../../../shared/types';

export type { ReplayAnalysisResult };

export const PROXIMITY_THRESHOLD_CHARS = 100;

interface ClassifiedLeaf {
  node: TextNode;
  paragraphIndex: number;
  isDirty: boolean;
}

/**
 * Inspects the live editor state and determines whether re-transcription
 * is eligible on resume. Must be called inside a Lexical `editorState.read()`.
 */
export function $analyzeReplayEligibility(): ReplayAnalysisResult {
  const root = $getRoot();
  const paragraphs = root.getChildren();

  // 1. Collect and classify all leaf nodes with paragraph context
  const leaves: ClassifiedLeaf[] = [];

  for (let pi = 0; pi < paragraphs.length; pi++) {
    const paragraph = paragraphs[pi];
    if (!$isParagraphNode(paragraph)) continue;

    for (const child of paragraph.getChildren()) {
      if (!$isTextNode(child)) continue;

      const isDirty = $isTimestampedTextNode(child)
        ? child.getTextContent() !== child.getOriginalText()
        : true; // plain TextNode is always dirty

      leaves.push({ node: child, paragraphIndex: pi, isDirty });
    }
  }

  // 2. Find the latest dirty node (scan from end)
  let latestDirtyIndex = -1;
  for (let i = leaves.length - 1; i >= 0; i--) {
    if (leaves[i].isDirty) {
      latestDirtyIndex = i;
      break;
    }
  }

  // No dirty nodes → no edit happened
  if (latestDirtyIndex === -1) {
    return { eligible: false, replayStartMs: null, replayGhostStartMs: null, blockedReason: 'none' };
  }

  const dirtyLeaf = leaves[latestDirtyIndex];
  const tailLeaves = leaves.slice(latestDirtyIndex + 1);

  // 3. Check for clean tail — need at least one clean node after the dirty node
  if (tailLeaves.length === 0) {
    return {
      eligible: false,
      replayStartMs: null,
      replayGhostStartMs: null,
      blockedReason: 'dirty-tail',
    };
  }

  // 4. Proximity gate — distance from dirty node to document end
  let distance = 0;
  let prevParagraphIndex = dirtyLeaf.paragraphIndex;
  for (const leaf of tailLeaves) {
    // Add paragraph separator if we crossed a paragraph boundary
    if (leaf.paragraphIndex !== prevParagraphIndex) {
      distance += LEXICAL_PARAGRAPH_SEPARATOR.length;
      prevParagraphIndex = leaf.paragraphIndex;
    }
    distance += leaf.node.getTextContent().length;
  }

  if (distance > PROXIMITY_THRESHOLD_CHARS) {
    return {
      eligible: false,
      replayStartMs: null,
      replayGhostStartMs: null,
      blockedReason: 'too-far-from-end',
    };
  }

  // 5. Paragraph-boundary guard — dirty node and clean tail must be in the same paragraph
  for (const leaf of tailLeaves) {
    if (leaf.paragraphIndex !== dirtyLeaf.paragraphIndex) {
      return {
        eligible: false,
        replayStartMs: null,
        replayGhostStartMs: null,
        blockedReason: 'paragraph-boundary',
      };
    }
  }

  // 6. Determine replayStartMs and replayGhostStartMs
  const firstCleanAfterDirty = tailLeaves[0];
  // All tail leaves are clean by definition (they come after the latest dirty node).
  // firstCleanAfterDirty must be a TimestampedTextNode since it's clean.
  if (!$isTimestampedTextNode(firstCleanAfterDirty.node)) {
    // Defensive: a plain TextNode in the tail would be dirty, but the latest
    // dirty node scan should have caught it. Treat as ineligible.
    return {
      eligible: false,
      replayStartMs: null,
      replayGhostStartMs: null,
      blockedReason: 'dirty-tail',
    };
  }

  const dirtyNode = dirtyLeaf.node;
  const isSuffixMatch =
    $isTimestampedTextNode(dirtyNode) &&
    dirtyNode.getTextContent().endsWith(dirtyNode.getOriginalText());

  let replayStartMs: number;
  let replayGhostStartMs: number;

  if (isSuffixMatch && $isTimestampedTextNode(dirtyNode)) {
    replayStartMs = dirtyNode.getStartMs();
    replayGhostStartMs = dirtyNode.getStartMs();
  } else {
    replayStartMs = firstCleanAfterDirty.node.getStartMs();
    replayGhostStartMs = firstCleanAfterDirty.node.getStartMs();
  }

  return {
    eligible: true,
    replayStartMs,
    replayGhostStartMs,
    blockedReason: 'none',
  };
}
