import { useEffect } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useOverlay } from '../OverlayContext';

const initialConfig = {
  namespace: 'StexEditor',
  onError: (error: Error) => console.error(error),
};

function EditorBridge() {
  const [editor] = useLexicalComposerContext();
  const { registerEditor } = useOverlay();

  useEffect(() => {
    registerEditor(editor);
  }, [editor, registerEditor]);

  return null;
}

export function Editor() {
  return (
    <div className="editor-container">
      <LexicalComposer initialConfig={initialConfig}>
        <RichTextPlugin
          contentEditable={<ContentEditable className="editor-input" />}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <AutoFocusPlugin />
        <EditorBridge />
      </LexicalComposer>
    </div>
  );
}
