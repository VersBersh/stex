import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $createTextNode, $createParagraphNode, $isParagraphNode } from 'lexical';
import type { HistoryState } from '@lexical/history';
import type { EditorBlockManager } from './editorBlockManager';
import type { SonioxToken } from '../../../shared/types';
import { useOverlay } from '../OverlayContext';

interface TokenCommitPluginProps {
  blockManager: EditorBlockManager;
  historyState: HistoryState;
}

export function TokenCommitPlugin({ blockManager, historyState }: TokenCommitPluginProps) {
  const [editor] = useLexicalComposerContext();
  const { registerClearHook } = useOverlay();

  // Keep block manager in sync when the editor is cleared
  useEffect(() => {
    return registerClearHook(() => blockManager.clear());
  }, [registerClearHook, blockManager]);

  useEffect(() => {
    const unsubscribe = window.api.onTokensFinal((tokens: SonioxToken[]) => {
      const text = tokens.map((t) => t.text).join('');
      if (text.length === 0) return;

      blockManager.commitFinalTokens(tokens);

      // Append to editor, bypassing undo history.
      // 'historic' tag causes HistoryPlugin to return DISCARD_HISTORY_CANDIDATE,
      // so this update is not recorded in the undo stack.
      // discrete: true makes the update synchronous.
      editor.update(
        () => {
          const root = $getRoot();
          const lastChild = root.getLastChild();
          if ($isParagraphNode(lastChild)) {
            lastChild.append($createTextNode(text));
          } else {
            const paragraph = $createParagraphNode();
            paragraph.append($createTextNode(text));
            root.append(paragraph);
          }
        },
        { discrete: true, tag: 'historic' },
      );

      // Invalidate existing undo/redo entries — they contain pre-transcription
      // editor states and restoring them would remove committed transcription text.
      // Then set current to the post-append state so future user edits create
      // undo entries relative to this state.
      historyState.undoStack.length = 0;
      historyState.redoStack.length = 0;
      historyState.current = { editor, editorState: editor.getEditorState() };
    });

    return unsubscribe;
  }, [editor, blockManager, historyState]);

  return null;
}
