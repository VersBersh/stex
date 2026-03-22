import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, KEY_ENTER_COMMAND, COMMAND_PRIORITY_HIGH } from 'lexical';
import type { EditorBlockManager } from './editorBlockManager';

interface InlineEditPluginProps {
  blockManager: EditorBlockManager;
}

export function InlineEditPlugin({ blockManager }: InlineEditPluginProps) {
  const [editor] = useLexicalComposerContext();

  // Enforce single-paragraph editing: the block manager tracks offsets without
  // paragraph separators, so multi-paragraph documents would cause offset drift.
  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      () => true, // returning true prevents default (paragraph split)
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, prevEditorState, tags }) => {
      // Skip programmatic updates (token commits use 'historic' tag)
      if (tags.has('historic')) return;

      const currentText = editorState.read(() => $getRoot().getTextContent());
      const prevText = prevEditorState.read(() => $getRoot().getTextContent());

      if (currentText === prevText) return;

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
