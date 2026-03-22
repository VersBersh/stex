import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getDocumentText } from './lexicalTextContract';
import type { EditorBlockManager } from './editorBlockManager';

interface InlineEditPluginProps {
  blockManager: EditorBlockManager;
}

export function InlineEditPlugin({ blockManager }: InlineEditPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, prevEditorState, tags }) => {
      // Skip programmatic updates (token commits use 'historic' tag)
      if (tags.has('historic')) return;

      const currentText = editorState.read(() => $getDocumentText());
      const prevText = prevEditorState.read(() => $getDocumentText());

      if (currentText === prevText) return;

      // Skip if another listener (e.g. UserTypingPlugin) already synced the blocks
      if (blockManager.getDocumentText() === currentText) return;

      const diff = findTextDiff(prevText, currentText);
      if (diff) {
        blockManager.applyEdit(diff.offset, diff.removedLength, diff.insertedText);
      }
    });
  }, [editor, blockManager]);

  return null;
}

// Pure function for computing minimal text diff — exported for testing
export function findTextDiff(
  prev: string,
  current: string,
): { offset: number; removedLength: number; insertedText: string } | null {
  let start = 0;
  const minLen = Math.min(prev.length, current.length);
  while (start < minLen && prev[start] === current[start]) {
    start++;
  }

  let prevEnd = prev.length;
  let currEnd = current.length;
  while (prevEnd > start && currEnd > start && prev[prevEnd - 1] === current[currEnd - 1]) {
    prevEnd--;
    currEnd--;
  }

  const removedLength = prevEnd - start;
  const insertedText = current.slice(start, currEnd);

  if (removedLength === 0 && insertedText.length === 0) return null;

  return { offset: start, removedLength, insertedText };
}
