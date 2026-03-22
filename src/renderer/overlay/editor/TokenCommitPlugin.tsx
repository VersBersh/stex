import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  $createTextNode,
  $createParagraphNode,
  $isParagraphNode,
} from 'lexical';
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

  // Keep block manager and history in sync when the editor is cleared
  useEffect(() => {
    return registerClearHook(() => {
      blockManager.clear();
      historyState.undoStack.length = 0;
      historyState.redoStack.length = 0;
      historyState.current = null;
    });
  }, [registerClearHook, blockManager, historyState]);

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

          // 1. Determine if cursor is a collapsed caret at the end of committed text.
          // Only a collapsed selection at the document tail should track (advance with new tokens).
          // Any non-collapsed selection or mid-document caret must be preserved.
          const prevSelection = $getSelection();
          const isRange = $isRangeSelection(prevSelection);

          let cursorAtEnd = true;
          if (isRange) {
            if (!prevSelection.isCollapsed()) {
              cursorAtEnd = false;
            } else {
              const lastParagraph = root.getLastChild();
              if ($isParagraphNode(lastParagraph)) {
                const anchorNode = prevSelection.anchor.getNode();
                const lastTextNode = lastParagraph.getLastChild();
                if ($isTextNode(lastTextNode)) {
                  // Caret on last text node at its end
                  cursorAtEnd =
                    anchorNode.getKey() === lastTextNode.getKey() &&
                    prevSelection.anchor.offset === lastTextNode.getTextContentSize();
                } else if (anchorNode.getKey() === lastParagraph.getKey()) {
                  // Caret on the paragraph element itself (at the end when no text nodes exist
                  // or after the last child)
                  cursorAtEnd = prevSelection.anchor.offset === lastParagraph.getChildrenSize();
                } else {
                  cursorAtEnd = false;
                }
              }
            }
          }

          // 2. Save selection state before mutation
          const savedAnchorKey = isRange ? prevSelection.anchor.key : null;
          const savedAnchorOffset = isRange ? prevSelection.anchor.offset : 0;
          const savedAnchorType = isRange ? prevSelection.anchor.type : 'text';
          const savedFocusKey = isRange ? prevSelection.focus.key : null;
          const savedFocusOffset = isRange ? prevSelection.focus.offset : 0;
          const savedFocusType = isRange ? prevSelection.focus.type : 'text';

          // 3. Append text
          const lastChild = root.getLastChild();
          if ($isParagraphNode(lastChild)) {
            lastChild.append($createTextNode(text));
          } else {
            const paragraph = $createParagraphNode();
            paragraph.append($createTextNode(text));
            root.append(paragraph);
          }

          // 4. Restore selection if cursor was mid-document
          if (!cursorAtEnd && isRange && savedAnchorKey && savedFocusKey) {
            const selection = prevSelection.clone();
            selection.anchor.set(savedAnchorKey, savedAnchorOffset, savedAnchorType);
            selection.focus.set(savedFocusKey, savedFocusOffset, savedFocusType);
            $setSelection(selection);
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
