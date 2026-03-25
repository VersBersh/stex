import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { type LexicalEditor, $getNodeByKey, $isTextNode } from 'lexical';
import { $isTimestampedTextNode } from './TimestampedTextNode';
import { isVerboseEditorLog, verboseLog } from './verboseEditorLog';

function registerDirtyLeavesLogger(editor: LexicalEditor): () => void {
  return editor.registerUpdateListener(({ editorState, prevEditorState, dirtyLeaves, tags }) => {
    if (!isVerboseEditorLog()) return;
    if (tags.has('historic')) return;
    if (dirtyLeaves.size === 0) return;

    verboseLog('dirtyLeaves', 'keys:', [...dirtyLeaves]);

    for (const key of dirtyLeaves) {
      let prevType: string | null = null;
      let prevText: string | null = null;
      let prevTimestampMeta: { startMs: number; endMs: number; originalText: string } | null = null;

      prevEditorState.read(() => {
        const prevNode = $getNodeByKey(key);
        if (prevNode) {
          prevType = prevNode.getType();
          prevText = $isTextNode(prevNode) ? prevNode.getTextContent() : '(non-text)';
          if ($isTimestampedTextNode(prevNode)) {
            prevTimestampMeta = {
              startMs: prevNode.getStartMs(),
              endMs: prevNode.getEndMs(),
              originalText: prevNode.getOriginalText(),
            };
          }
        }
      });

      editorState.read(() => {
        const node = $getNodeByKey(key);

        let action: string;
        if (prevType === null && node !== null) action = 'CREATED';
        else if (prevType !== null && node === null) action = 'REMOVED';
        else if (prevType !== null && node !== null) action = 'MUTATED';
        else action = 'UNKNOWN';

        const nodeType = node ? node.getType() : null;
        const textContent = node && $isTextNode(node) ? node.getTextContent() : null;

        const meta: Record<string, unknown> = {
          key,
          action,
          prev: prevType ? { type: prevType, text: prevText, ...(prevTimestampMeta || {}) } : null,
          curr: node ? {
            type: nodeType,
            text: textContent,
            ...($isTimestampedTextNode(node) ? {
              startMs: node.getStartMs(),
              endMs: node.getEndMs(),
              originalText: node.getOriginalText(),
            } : {}),
          } : null,
        };

        verboseLog('dirtyLeaf', JSON.stringify(meta));
      });
    }
  });
}

export function DirtyLeavesLogPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return registerDirtyLeavesLogger(editor);
  }, [editor]);
  return null;
}
