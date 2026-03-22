import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { UNDO_COMMAND, REDO_COMMAND, COMMAND_PRIORITY_LOW } from 'lexical';
import { $getDocumentText } from './lexicalTextContract';
import type { HistoryState } from '@lexical/history';
import type { BlockHistory } from './editorBlockManager';

interface UndoRedoBlockSyncPluginProps {
  historyState: HistoryState;
  blockHistory: BlockHistory;
}

/**
 * Keeps the block manager's state (text, structure, modified flags) in sync
 * with Lexical's undo/redo operations by maintaining parallel snapshot stacks.
 *
 * Ordering dependency: this plugin must appear in JSX AFTER HistoryPlugin
 * (to observe stack changes) and BEFORE InlineEditPlugin (to snapshot blocks
 * before applyEdit mutates them). JSX order determines useEffect registration
 * order, which determines update listener fire order.
 *
 * PUSH-vs-MERGE detection: we detect whether HistoryPlugin pushed a new undo
 * entry by comparing the identity of the top stack entry. On PUSH, Lexical
 * creates a new object via `undoStack.push({...current})`; on MERGE, it only
 * updates `historyState.current` without pushing. Verified against Lexical
 * v0.22.x (@lexical/history LexicalHistory.dev.mjs, lines 245-254).
 */
export function UndoRedoBlockSyncPlugin({
  historyState,
  blockHistory,
}: UndoRedoBlockSyncPluginProps) {
  const [editor] = useLexicalComposerContext();

  // Capture pre-edit block snapshots when HistoryPlugin pushes a new undo entry
  useEffect(() => {
    let lastSeenUndoTop: unknown = null;

    return editor.registerUpdateListener(({ editorState, prevEditorState, tags }) => {
      if (tags.has('historic')) return;

      const currentText = editorState.read(() => $getDocumentText());
      const prevText = prevEditorState.read(() => $getDocumentText());
      if (currentText === prevText) return;

      const undoStack = historyState.undoStack;
      const undoTop = undoStack.length > 0 ? undoStack[undoStack.length - 1] : null;

      if (undoTop !== null && undoTop !== lastSeenUndoTop) {
        // PUSH detected — snapshot pre-edit block state.
        // At this point, InlineEditPlugin hasn't fired yet, so blockManager
        // still holds the pre-edit state.
        blockHistory.captureBeforeEdit();
      }

      lastSeenUndoTop = undoTop;
    });
  }, [editor, historyState, blockHistory]);

  // UNDO: restore previous block state, save current to redo
  useEffect(() => {
    return editor.registerCommand(
      UNDO_COMMAND,
      () => {
        blockHistory.handleUndo();
        return false; // let HistoryPlugin handle the actual undo
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, blockHistory]);

  // REDO: restore next block state, save current to undo
  useEffect(() => {
    return editor.registerCommand(
      REDO_COMMAND,
      () => {
        blockHistory.handleRedo();
        return false; // let HistoryPlugin handle the actual redo
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, blockHistory]);

  return null;
}
