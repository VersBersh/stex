import { $getRoot, $isParagraphNode, $isTextNode } from 'lexical';
import { $isTimestampedTextNode } from './TimestampedTextNode';

export interface ReplayGhostConversionResult {
  ghostText: string;
  removedCharCount: number;
}

/**
 * Removes the replay-eligible tail from the editor and returns the text
 * to display as ghost text. Must be called inside editor.update().
 *
 * Algorithm:
 * 1. Walk all leaf nodes in the last paragraph
 * 2. Find the first node with startMs >= replayGhostStartMs
 * 3. If that node is a dirty suffix-match TimestampedTextNode:
 *    - Truncate it to the user-authored prefix
 *    - Add its originalText to ghost text
 * 4. Remove all subsequent nodes (they should all be clean TimestampedTextNodes)
 * 5. Collect removed text as ghost text
 */
export function $convertToReplayGhost(replayGhostStartMs: number): ReplayGhostConversionResult {
  const root = $getRoot();
  const paragraphs = root.getChildren();

  // Work backwards to find the last paragraph with content
  let targetParagraph = null;
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    if ($isParagraphNode(paragraphs[i]) && paragraphs[i].getChildrenSize() > 0) {
      targetParagraph = paragraphs[i];
      break;
    }
  }

  if (!targetParagraph) return { ghostText: '', removedCharCount: 0 };

  const children = targetParagraph.getChildren();
  let ghostText = '';
  let removedCharCount = 0;
  let foundStart = false;

  for (const child of children) {
    if (!$isTextNode(child)) continue;

    if (!foundStart && $isTimestampedTextNode(child)) {
      if (child.getStartMs() >= replayGhostStartMs) {
        foundStart = true;

        // Check if this is a dirty suffix-match node
        const currentText = child.getTextContent();
        const originalText = child.getOriginalText();
        const isDirty = currentText !== originalText;
        const isSuffixMatch = isDirty && currentText.endsWith(originalText);

        if (isSuffixMatch) {
          // Keep the user-authored prefix, fold originalText into ghost
          const prefix = currentText.slice(0, currentText.length - originalText.length);
          ghostText += originalText;
          removedCharCount += originalText.length;

          if (prefix.length > 0) {
            child.setTextContent(prefix);
          } else {
            child.remove();
          }
          continue;
        }

        // Not a suffix-match: this should be a clean node. Remove entirely.
        ghostText += currentText;
        removedCharCount += currentText.length;
        child.remove();
        continue;
      }
    } else if (foundStart) {
      // All nodes after the start point are removed
      const text = child.getTextContent();
      ghostText += text;
      removedCharCount += text.length;
      child.remove();
      continue;
    }
  }

  return { ghostText, removedCharCount };
}
