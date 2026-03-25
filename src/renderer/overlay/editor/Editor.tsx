import { useEffect, useMemo } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { createEmptyHistoryState } from '@lexical/history';
import { GhostTextPlugin } from './GhostTextPlugin';
import { useOverlay } from '../OverlayContext';
import { TokenCommitPlugin } from './TokenCommitPlugin';
import { createEditorBlockManager, createBlockHistory } from './editorBlockManager';
import { InlineEditPlugin } from './InlineEditPlugin';
import { UserTypingPlugin } from './UserTypingPlugin';
import { UndoRedoBlockSyncPlugin } from './UndoRedoBlockSyncPlugin';
import { DirtyLeavesLogPlugin } from './DirtyLeavesLogPlugin';
import { TimestampedTextNode } from './TimestampedTextNode';

const initialConfig = {
  namespace: 'StexEditor',
  nodes: [TimestampedTextNode],
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
  const historyState = useMemo(() => createEmptyHistoryState(), []);
  const blockManager = useMemo(() => createEditorBlockManager(), []);
  const blockHistory = useMemo(() => createBlockHistory(blockManager), [blockManager]);

  return (
    <div className="editor-container">
      <LexicalComposer initialConfig={initialConfig}>
        <RichTextPlugin
          contentEditable={<ContentEditable className="editor-input" />}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin externalHistoryState={historyState} />
        <AutoFocusPlugin />
        <EditorBridge />
        <TokenCommitPlugin blockManager={blockManager} historyState={historyState} blockHistory={blockHistory} />
        {/* UndoRedoBlockSyncPlugin must be AFTER HistoryPlugin (to observe stack changes)
            and BEFORE InlineEditPlugin (to snapshot blocks before applyEdit mutates them).
            JSX order determines useEffect registration order, which determines update listener fire order. */}
        <UndoRedoBlockSyncPlugin historyState={historyState} blockHistory={blockHistory} />
        <InlineEditPlugin blockManager={blockManager} />
        <UserTypingPlugin blockManager={blockManager} />
        <GhostTextPlugin />
        <DirtyLeavesLogPlugin />
      </LexicalComposer>
    </div>
  );
}
