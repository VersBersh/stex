import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getDocumentText } from './lexicalTextContract';
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
        const fullText = $getDocumentText();
        const baseText = blockManager.getBaseText();

        if (!fullText.startsWith(baseText)) return;

        const tailText = fullText.slice(baseText.length);
        blockManager.replaceLastUserBlock(tailText);
      });
    });
  }, [editor, blockManager]);

  return null;
}
