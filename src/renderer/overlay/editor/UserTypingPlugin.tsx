import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot } from 'lexical';
import type { EditorBlockManager } from './editorBlockManager';

interface UserTypingPluginProps {
  blockManager: EditorBlockManager;
}

export function UserTypingPlugin({ blockManager }: UserTypingPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ tags }) => {
      if (tags.has('historic')) return;

      editor.getEditorState().read(() => {
        const fullText = $getRoot().getTextContent();
        const baseText = blockManager.getBaseText();

        if (!fullText.startsWith(baseText)) return;

        const tailText = fullText.slice(baseText.length);
        blockManager.replaceLastUserBlock(tailText);
      });
    });
  }, [editor, blockManager]);

  return null;
}
