import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { type LexicalEditor } from 'lexical';
import { $getDocumentText } from './lexicalTextContract';
import type { EditorBlockManager } from './editorBlockManager';

interface UserTypingPluginProps {
  blockManager: EditorBlockManager;
}

export function registerUserTypingListener(
  editor: LexicalEditor,
  blockManager: EditorBlockManager,
): () => void {
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
}

export function UserTypingPlugin({ blockManager }: UserTypingPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return registerUserTypingListener(editor, blockManager);
  }, [editor, blockManager]);

  return null;
}
