import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  $createParagraphNode,
  $isParagraphNode,
} from 'lexical';
import { $isCursorAtDocumentEnd, $moveCursorToDocumentEnd } from './cursor-track-utils';
import { $createTimestampedTextNode, $isTimestampedTextNode } from './TimestampedTextNode';
import { isVerboseEditorLog, verboseLog } from './verboseEditorLog';
import { mergeTokens, flushPending, type MergedToken } from './tokenMerger';
import { $convertToReplayGhost } from './replayGhostConversion';
import { escapeForCSSContent } from './ghost-text-utils';
import type { HistoryState } from '@lexical/history';
import type { EditorBlockManager, BlockHistory } from './editorBlockManager';
import type { SonioxToken } from '../../../shared/types';
import { useOverlay } from '../OverlayContext';

/** Delay before flushing the pending token buffer after the last final-token batch.
 *  Must be longer than the typical gap between consecutive Soniox responses
 *  (~100-200ms during active speech) to avoid flushing mid-word. */
const PENDING_FLUSH_TIMEOUT_MS = 300;

interface TokenCommitPluginProps {
  blockManager: EditorBlockManager;
  historyState: HistoryState;
  blockHistory: BlockHistory;
}

export function TokenCommitPlugin({ blockManager, historyState, blockHistory }: TokenCommitPluginProps) {
  const [editor] = useLexicalComposerContext();
  const { registerClearHook } = useOverlay();
  const pendingRef = useRef<SonioxToken[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep block manager and history in sync when the editor is cleared
  useEffect(() => {
    return registerClearHook(() => {
      blockManager.clear();
      historyState.undoStack.length = 0;
      historyState.redoStack.length = 0;
      historyState.current = null;
      blockHistory.clear();
    });
  }, [registerClearHook, blockManager, historyState, blockHistory]);

  // Reset undo/redo history when editor is cleared (e.g. onShow: 'fresh')
  useEffect(() => {
    return registerClearHook(() => {
      historyState.undoStack.length = 0;
      historyState.redoStack.length = 0;
      historyState.current = { editor, editorState: editor.getEditorState() };
      blockHistory.clear();
    });
  }, [registerClearHook, historyState, editor, blockHistory]);

  // Discard pending token buffer and cancel flush timer when editor is cleared
  useEffect(() => {
    return registerClearHook(() => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingRef.current = [];
    });
  }, [registerClearHook]);

  // Clean up flush timer on unmount
  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, []);

  // Commit merged words to blockManager and editor
  function commitWords(words: MergedToken[]) {
    if (words.length === 0) return;

    blockManager.commitFinalText(words.map((w) => w.text).join(''));

    // Capture scroll position before mutation so we can detect whether the
    // user was already at the bottom (a large append could push scrollHeight
    // past the threshold if checked after the update).
    let wasNearBottom = false;
    const preRoot = editor.getRootElement();
    if (preRoot) {
      const c = preRoot.parentElement;
      if (c) {
        wasNearBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 50;
      }
    }

    // Capture child count before mutation for token-commit logging
    const verbose = isVerboseEditorLog();
    let childCountBefore = 0;
    if (verbose) {
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const last = root.getLastChild();
        if ($isParagraphNode(last)) childCountBefore = last.getChildrenSize();
      });
    }

    // Append to editor, bypassing undo history.
    // 'historic' tag causes HistoryPlugin to return DISCARD_HISTORY_CANDIDATE,
    // so this update is not recorded in the undo stack.
    // discrete: true makes the update synchronous.
    let cursorAtEnd = true;
    editor.update(
      () => {
        const root = $getRoot();

        // 1. Determine if cursor is a collapsed caret at the end of committed text.
        // Only a collapsed selection at the document tail should track (advance with new tokens).
        // Any non-collapsed selection or mid-document caret must be preserved.
        const prevSelection = $getSelection();
        const isRange = $isRangeSelection(prevSelection);
        // No range selection (e.g. editor never focused) → default to tracking.
        // Stale selection after clear → $isCursorAtDocumentEnd handles via empty-root check.
        cursorAtEnd = !isRange || $isCursorAtDocumentEnd();

        // 2. Save selection state before mutation
        const savedAnchorKey = isRange ? prevSelection.anchor.key : null;
        const savedAnchorOffset = isRange ? prevSelection.anchor.offset : 0;
        const savedAnchorType = isRange ? prevSelection.anchor.type : 'text';
        const savedFocusKey = isRange ? prevSelection.focus.key : null;
        const savedFocusOffset = isRange ? prevSelection.focus.offset : 0;
        const savedFocusType = isRange ? prevSelection.focus.type : 'text';

        // 3. Append text — one TimestampedTextNode per merged word
        const lastChild = root.getLastChild();
        const targetParagraph = $isParagraphNode(lastChild)
          ? lastChild
          : (() => { const p = $createParagraphNode(); root.append(p); return p; })();
        for (const word of words) {
          targetParagraph.append(
            $createTimestampedTextNode(word.text, word.startMs, word.endMs, word.originalText),
          );
        }

        // 4. Update selection: move cursor to new end if it was tracking,
        // otherwise restore the mid-document position.
        if (cursorAtEnd) {
          $moveCursorToDocumentEnd();
        } else if (isRange && savedAnchorKey && savedFocusKey) {
          const selection = prevSelection.clone();
          selection.anchor.set(savedAnchorKey, savedAnchorOffset, savedAnchorType);
          selection.focus.set(savedFocusKey, savedFocusOffset, savedFocusType);
          $setSelection(selection);
        }
      },
      { discrete: true, tag: 'historic' },
    );

    // Log committed nodes
    if (verbose) {
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const last = root.getLastChild();
        if ($isParagraphNode(last)) {
          const children = last.getChildren();
          const newChildren = children.slice(childCountBefore);
          verboseLog('tokenCommit', `committed ${newChildren.length} node(s):`);
          for (const child of newChildren) {
            const meta: Record<string, unknown> = {
              key: child.getKey(),
              nodeType: child.getType(),
              text: child.getTextContent(),
            };
            if ($isTimestampedTextNode(child)) {
              meta.startMs = child.getStartMs();
              meta.endMs = child.getEndMs();
              meta.originalText = child.getOriginalText();
            }
            verboseLog('tokenCommit', JSON.stringify(meta));
          }
        }
      });
    }

    // Scroll the editor container to follow transcription when the cursor
    // is at the document end and the viewport was near the bottom before the update.
    if (cursorAtEnd && wasNearBottom) {
      const rootElement = editor.getRootElement();
      if (rootElement) {
        const container = rootElement.parentElement;
        if (container) {
          const overflow = container.scrollHeight - container.scrollTop - container.clientHeight;
          if (overflow > 0) {
            container.scrollTop = container.scrollHeight;
          }
        }
      }
    }

    // Invalidate existing undo/redo entries — they contain pre-transcription
    // editor states and restoring them would remove committed transcription text.
    // Then set current to the post-append state so future user edits create
    // undo entries relative to this state.
    historyState.undoStack.length = 0;
    historyState.redoStack.length = 0;
    historyState.current = { editor, editorState: editor.getEditorState() };
    blockHistory.clear();
  }

  useEffect(() => {
    const unsubscribe = window.api.onTokensFinal((tokens: SonioxToken[]) => {
      const text = tokens.map((t) => t.text).join('');
      if (text.length === 0) return;

      const { words, newPending } = mergeTokens(pendingRef.current, tokens);
      pendingRef.current = newPending;

      commitWords(words);

      // Reset flush timer — if no new tokens arrive within the timeout,
      // flush the pending buffer so the last word appears after a pause.
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      if (newPending.length > 0) {
        flushTimerRef.current = setTimeout(() => {
          flushTimerRef.current = null;
          const flushed = flushPending(pendingRef.current);
          pendingRef.current = [];
          if (flushed) {
            commitWords([flushed]);
          }
        }, PENDING_FLUSH_TIMEOUT_MS);
      }
    });

    return unsubscribe;
  }, [editor, blockManager, historyState, blockHistory]);

  // Flush pending tokens on session pause and stop
  useEffect(() => {
    function flush() {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      const flushed = flushPending(pendingRef.current);
      pendingRef.current = [];
      if (flushed) {
        commitWords([flushed]);
      }
    }

    const unsubPaused = window.api.onSessionPaused(flush);
    const unsubStop = window.api.onSessionStop(flush);

    return () => {
      unsubPaused();
      unsubStop();
    };
  }, [editor, blockManager, historyState, blockHistory]);

  // Convert clean tail to replay ghost text when replay starts
  useEffect(() => {
    const unsubReplayGhost = window.api.onReplayGhostConvert((replayGhostStartMs: number) => {
      let ghostText = '';
      let removedCharCount = 0;

      editor.update(
        () => {
          const result = $convertToReplayGhost(replayGhostStartMs);
          ghostText = result.ghostText;
          removedCharCount = result.removedCharCount;
        },
        { discrete: true, tag: 'historic' },
      );

      // Set initial replay ghost text via CSS (same mechanism as GhostTextPlugin)
      if (ghostText) {
        const rootElement = editor.getRootElement();
        if (rootElement) {
          rootElement.style.setProperty('--ghost-text-content', escapeForCSSContent(ghostText));
        }
      }

      // Sync blockManager: remove the tail text that was moved to ghost
      if (removedCharCount > 0) {
        const docLen = blockManager.getDocumentLength();
        blockManager.applyEdit(docLen - removedCharCount, removedCharCount, '');
      }

      // Flush pending tokens — replay starts a fresh token stream
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      const flushed = flushPending(pendingRef.current);
      pendingRef.current = [];
      if (flushed) {
        commitWords([flushed]);
      }

      // Reset undo/redo since the document state has changed
      historyState.undoStack.length = 0;
      historyState.redoStack.length = 0;
      historyState.current = { editor, editorState: editor.getEditorState() };
      blockHistory.clear();
    });

    return unsubReplayGhost;
  }, [editor, blockManager, historyState, blockHistory]);

  return null;
}
