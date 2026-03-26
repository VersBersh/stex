# Plan — Task 154: Replay Ghost Regions

## Goal

Convert the eligible clean tail of the document into replay ghost text before replay begins, then re-commit Soniox's re-transcribed tokens through the normal final-token commit path with correct absolute timestamps and `historic` tagging.

## Dependencies

This task layers on top of:
- **Task 150** (implementing): `connectionBaseMs` variable and `applyTimestampOffset()` in `soniox-lifecycle.ts`
- **Task 149** (implementing): `AudioRingBuffer` integration in `soniox-lifecycle.ts`
- **Task 152** (planned): `reconnectWithContext()`, async `resumeSession()` with resume analysis IPC, `ReplayAnalysisResult` in shared types, `ResumeAnalysisResult`, `SESSION_RESUME_ANALYSIS` channel
- **Task 153** (planned): `capturePendingStartMs()`/`getPendingStartMs()` in `soniox-lifecycle.ts`

All steps reference APIs from these tasks. If the actual implementations diverge, adapt accordingly.

## Steps

### Step 1: Add IPC channel for replay ghost conversion

**File:** `src/shared/ipc.ts`

Add a new channel constant:

```ts
SESSION_REPLAY_GHOST_CONVERT: 'session:replay-ghost-convert',
```

This is a main → renderer push event. Main sends a bare `number` (the `replayGhostStartMs` value) as the payload. No renderer response needed.

### Step 2: Extend preload API for replay ghost conversion

**File:** `src/shared/preload.d.ts`

Add to `ElectronAPI`:

```ts
onReplayGhostConvert(callback: (replayGhostStartMs: number) => void): () => void;
```

**File:** `src/preload/index.ts`

Add implementation following the existing listener pattern:

```ts
onReplayGhostConvert: (callback: (replayGhostStartMs: number) => void) => {
  const handler = (_event: unknown, replayGhostStartMs: number) => callback(replayGhostStartMs);
  ipcRenderer.on(IpcChannels.SESSION_REPLAY_GHOST_CONVERT, handler);
  return () => { ipcRenderer.removeListener(IpcChannels.SESSION_REPLAY_GHOST_CONVERT, handler); };
},
```

**Depends on:** Step 1.

### Step 3: Create `$convertToReplayGhost()` function

**File:** `src/renderer/overlay/editor/replayGhostConversion.ts` (new file)

This Lexical command function removes the eligible clean tail from the editor and returns the text that should be displayed as ghost text. Must be called inside a Lexical `editor.update()` callback.

```ts
import { $getRoot, $isParagraphNode, $isTextNode } from 'lexical';
import { $isTimestampedTextNode } from './TimestampedTextNode';

export interface ReplayGhostConversionResult {
  ghostText: string;
  removedCharCount: number;
}

/**
 * Removes the replay-eligible tail from the editor and returns the text
 * to display as ghost text. Must be called inside editor.update().
 *
 * Algorithm:
 * 1. Walk all leaf nodes in the last paragraph
 * 2. Find the first node with startMs >= replayGhostStartMs
 * 3. If that node is a dirty suffix-match TimestampedTextNode:
 *    - Truncate it to the user-authored prefix
 *    - Add its originalText to ghost text
 * 4. Remove all subsequent nodes (they should all be clean TimestampedTextNodes)
 * 5. Collect removed text as ghost text
 */
export function $convertToReplayGhost(replayGhostStartMs: number): ReplayGhostConversionResult {
  const root = $getRoot();
  const paragraphs = root.getChildren();

  // Work backwards to find the last paragraph with content
  let targetParagraph = null;
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    if ($isParagraphNode(paragraphs[i]) && paragraphs[i].getChildrenSize() > 0) {
      targetParagraph = paragraphs[i];
      break;
    }
  }

  if (!targetParagraph) return { ghostText: '', removedCharCount: 0 };

  const children = targetParagraph.getChildren();
  let ghostText = '';
  let removedCharCount = 0;
  let foundStart = false;

  for (const child of children) {
    if (!$isTextNode(child)) continue;

    if (!foundStart && $isTimestampedTextNode(child)) {
      if (child.getStartMs() >= replayGhostStartMs) {
        foundStart = true;

        // Check if this is a dirty suffix-match node
        const currentText = child.getTextContent();
        const originalText = child.getOriginalText();
        const isDirty = currentText !== originalText;
        const isSuffixMatch = isDirty && currentText.endsWith(originalText);

        if (isSuffixMatch) {
          // Keep the user-authored prefix, fold originalText into ghost
          const prefix = currentText.slice(0, currentText.length - originalText.length);
          ghostText += originalText;
          removedCharCount += originalText.length;

          if (prefix.length > 0) {
            // Truncate the node to just the prefix
            child.setTextContent(prefix);
          } else {
            // No prefix — remove the entire node
            child.remove();
          }
          continue;
        }

        // Not a suffix-match: this should be a clean node. Remove entirely.
        ghostText += currentText;
        removedCharCount += currentText.length;
        child.remove();
        continue;
      }
    } else if (foundStart) {
      // All nodes after the start point are removed
      ghostText += child.getTextContent();
      removedCharCount += child.getTextContent().length;
      child.remove();
      continue;
    }
  }

  return { ghostText, removedCharCount };
}
```

**Key design decisions:**
- Operates on the last paragraph only (eligibility analysis ensures everything is in the same paragraph).
- Matches by `startMs >= replayGhostStartMs` to find the conversion boundary.
- In the suffix-match case, uses `setTextContent()` to truncate the dirty node. This preserves the `TimestampedTextNode` type and its timestamps. The timestamps now apply to a shorter text, but the node was already dirty (user-modified). After replay re-commits fresh nodes, the old dirty node's timestamps become irrelevant.
- Returns `removedCharCount` so the caller can update `editorBlockManager`.

**Depends on:** None (uses existing Lexical APIs).

### Step 4: Add replay ghost conversion handler to `TokenCommitPlugin`

**File:** `src/renderer/overlay/editor/TokenCommitPlugin.tsx`

Add a new `useEffect` that listens for the `onReplayGhostConvert` IPC and performs the conversion:

```ts
import { $convertToReplayGhost } from './replayGhostConversion';
import { escapeForCSSContent } from './ghost-text-utils';

// Inside the component, after the existing useEffect blocks:

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
```

**Key design decisions:**
- Uses `tag: 'historic'` for the node removal so other plugins (InlineEditPlugin, UndoRedoBlockSyncPlugin) ignore it.
- Manually syncs blockManager via `applyEdit` because InlineEditPlugin won't process the `historic`-tagged update.
- Sets ghost text CSS directly on the root element (same mechanism as `GhostTextPlugin`). This is the initial replay ghost text that will be overwritten by connection B's non-final tokens.
- Flushes pending tokens from the previous connection's token stream.
- Clears undo/redo history since the document state changed (consistent with how `commitWords` handles history).

**Depends on:** Steps 2, 3.

### Step 5: Extend `AudioRingBuffer.sliceFrom` to return actual start timestamp

**File:** `src/main/audio-ring-buffer.ts`

The current `sliceFrom(ms)` returns `Buffer | null`. It finds the last chunk with `startMs <= ms` and concatenates from there. This means the returned audio may start earlier than `ms` (at the chunk boundary).

For replay, we need the *actual* start timestamp of the returned audio so `connectionBaseMs` is set correctly. Add a variant that returns the actual start:

```ts
export interface AudioSlice {
  data: Buffer;
  actualStartMs: number;
}

sliceFromWithMeta(ms: number): AudioSlice | null {
  if (this.chunks.length === 0) return null;
  if (ms < this.chunks[0].startMs) return null;
  if (ms >= this.currentMs) return null;

  // Binary search for the last chunk with startMs <= ms
  let lo = 0;
  let hi = this.chunks.length - 1;
  let idx = 0;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (this.chunks[mid].startMs <= ms) {
      idx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return {
    data: Buffer.concat(this.chunks.slice(idx).map((c) => c.data)),
    actualStartMs: this.chunks[idx].startMs,
  };
}
```

The existing `sliceFrom` method remains unchanged for backward compatibility.

**Why:** `connectionBaseMs` must equal the actual start of the replay audio, not the requested start. If the ring buffer's chunk boundary starts at 980ms but we requested 1000ms, `connectionBaseMs` should be 980ms so that Soniox token timestamps (relative to the audio it receives) map correctly to absolute session time.

**Depends on:** None.

### Step 6: Modify `reconnectWithContext` to support replay parameters

**File:** `src/main/soniox-lifecycle.ts`

Task 152 adds `reconnectWithContext(contextText: string)`. Modify it to accept optional replay configuration and an `onReady` callback that fires after connection opens:

```ts
export interface ReplayConfig {
  replayStartMs: number;
  replayGhostStartMs: number;
}

export function reconnectWithContext(
  contextText: string,
  options?: {
    replay?: ReplayConfig;
    onReady?: () => void;
  },
): void {
  if (!activeCallbacks) return;

  // ... existing disconnect logic from task 152 ...

  // Set connectionBaseMs based on replay
  if (options?.replay) {
    // Will be updated to actualStartMs after slicing ring buffer.
    // For now, set to replayStartMs — the onReady callback can
    // adjust if the ring buffer slice starts earlier.
    connectionBaseMs = options.replay.replayStartMs;
  } else {
    connectionBaseMs = ringBuffer?.currentMs ?? 0;
  }

  // ... existing state reset, SonioxClient creation from task 152 ...

  const callbacks = activeCallbacks;
  const baseMs = connectionBaseMs;

  soniox = new SonioxClient({
    onConnected: () => {
      info('Soniox reconnected with fresh context');

      // Execute post-connect callback first (e.g., send replay audio)
      // This happens before mic capture starts so replay audio is first
      // in the stream.
      options?.onReady?.();

      // Then start mic capture
      try {
        startCapture(onAudioData, onAudioError);
      } catch (err) {
        error('Failed to start audio capture after reconnect: %s', (err as Error).message);
        const errorInfo = classifyAudioError(err as Error);
        soniox?.disconnect();
        soniox = null;
        callbacks.onStatusChange('error');
        callbacks.onError(errorInfo);
        return;
      }
      callbacks.onStatusChange('recording');
    },
    onFinalTokens: (tokens: SonioxToken[]) => {
      // Check if replay draining is complete
      if (replayPhase === 'draining' && tokens.length > 0) {
        const lastTokenEndMs = tokens[tokens.length - 1].end_ms; // connection-relative
        if (lastTokenEndMs >= replayEndRelativeMs - 50) { // 50ms tolerance
          info('Replay draining complete (lastTokenEnd=%d, replayEnd=%d)',
            lastTokenEndMs, replayEndRelativeMs);
          endReplayPhase();
        }
      }
      callbacks.onFinalTokens(applyTimestampOffset(tokens, baseMs));
    },
    onNonFinalTokens: (tokens: SonioxToken[]) => {
      callbacks.onNonFinalTokens(applyTimestampOffset(tokens, baseMs));
    },
    // ... rest unchanged from task 152 ...
  });

  soniox.connect(settings, contextText);
}
```

**Key design decisions:**
- `onReady` callback fires inside `onConnected`, **before** mic capture starts. This ensures replay audio is the first data sent to connection B.
- `connectionBaseMs` is set for the token offset calculation in the `onFinalTokens`/`onNonFinalTokens` callbacks.
- The replay drain check is placed in the `onFinalTokens` callback where it has access to the incoming token timestamps.

**Depends on:** Task 152 (provides the base `reconnectWithContext`).

### Step 7: Add replay phase tracking to `soniox-lifecycle`

**File:** `src/main/soniox-lifecycle.ts`

Add module-level state for replay phase management:

```ts
let replayPhase: 'idle' | 'replaying' | 'draining' = 'idle';
let postResumeLiveBuffer: Buffer[] = [];
let replayEndRelativeMs = 0; // Frozen: connection-relative end of replay audio
```

`replayEndRelativeMs` is an immutable value captured when replay audio is sent. It represents the end of the replay audio in connection-relative time (i.e., total duration of replay audio). This is used by the drain detection in Step 6's `onFinalTokens` callback.

Add functions:

```ts
export function isInReplayPhase(): boolean {
  return replayPhase !== 'idle';
}

export function beginReplayPhase(): void {
  replayPhase = 'replaying';
  postResumeLiveBuffer = [];
  replayEndRelativeMs = 0;
}

export function endReplayPhase(): void {
  replayPhase = 'idle';
  replayEndRelativeMs = 0;
  // Flush buffered live audio to Soniox
  info('Flushing %d buffered live audio chunks', postResumeLiveBuffer.length);
  for (const chunk of postResumeLiveBuffer) {
    soniox?.sendAudio(chunk);
  }
  postResumeLiveBuffer = [];
}
```

Modify `onAudioData` to buffer live audio during replay:

```ts
function onAudioData(chunk: Buffer): void {
  ringBuffer?.push(chunk);

  if (replayPhase !== 'idle') {
    // During replay, buffer live audio locally instead of sending to Soniox.
    // The ring buffer still receives it for continuity.
    postResumeLiveBuffer.push(chunk);
  } else {
    soniox?.sendAudio(chunk);
  }

  // ... existing audio level monitoring code unchanged ...
}
```

Reset in `resetLifecycle()`:

```ts
replayPhase = 'idle';
postResumeLiveBuffer = [];
replayEndRelativeMs = 0;
```

**Key design decisions:**
- During replay, live audio is buffered locally instead of sent to Soniox. This prevents mixing replay audio with live audio on connection B.
- `endReplayPhase()` flushes the buffer to Soniox, ensuring no audio is lost.
- The ring buffer still receives all audio (both during replay and live), maintaining session-level continuity.
- `replayEndRelativeMs` is an immutable snapshot captured when replay audio is sent (Step 8). It does NOT use `ringBuffer.currentMs` which keeps growing. This fixes the moving-target drain detection issue.

**Depends on:** Task 149 (ring buffer in `onAudioData`).

### Step 8: Add replay audio sending function

**File:** `src/main/soniox-lifecycle.ts`

Add a function to send replay audio to the active connection. This must be called from the `onReady` callback (inside `onConnected`) to ensure the WebSocket is open.

```ts
const REPLAY_DRAIN_TIMEOUT_MS = 10000;

export function sendReplayAudio(fromMs: number): void {
  const slice = ringBuffer?.sliceFromWithMeta(fromMs);
  if (!slice || slice.data.length === 0) {
    warn('No replay audio available from %dms', fromMs);
    endReplayPhase();
    return;
  }

  // Update connectionBaseMs to the actual start of the ring buffer slice.
  // This may differ from the requested fromMs due to chunk boundaries.
  connectionBaseMs = slice.actualStartMs;
  info('Sending replay audio: %d bytes from actualStart=%dms (requested=%dms)',
    slice.data.length, slice.actualStartMs, fromMs);

  // Compute the replay audio duration in connection-relative time.
  // This is the total duration of audio being replayed.
  const replayAudioDurationMs = (slice.data.length / BYTES_PER_SAMPLE / SAMPLE_RATE) * 1000;
  replayEndRelativeMs = replayAudioDurationMs;

  soniox?.sendAudio(slice.data);

  // Move to draining phase — waiting for Soniox to process the replay audio
  replayPhase = 'draining';

  // Safety timeout: if draining doesn't complete naturally, force end
  setTimeout(() => {
    if (replayPhase === 'draining') {
      warn('Replay drain timeout after %dms — forcing end of replay phase', REPLAY_DRAIN_TIMEOUT_MS);
      endReplayPhase();
    }
  }, REPLAY_DRAIN_TIMEOUT_MS);
}
```

Note: `BYTES_PER_SAMPLE` and `SAMPLE_RATE` need to be imported or defined. These constants (2 and 16000) are already defined in `audio-ring-buffer.ts` but not exported. Either export them or redefine locally:

```ts
const REPLAY_SAMPLE_RATE = 16000;
const REPLAY_BYTES_PER_SAMPLE = 2;
```

**Key design decisions:**
- Uses `sliceFromWithMeta` (Step 5) to get both the audio data and the actual start timestamp.
- Updates `connectionBaseMs` to `slice.actualStartMs` — this ensures token timestamps from connection B are correctly mapped to session audio time. This fixes the chunk-boundary mismatch identified in the review.
- `replayEndRelativeMs` is computed from the byte length of the replay audio, giving an immutable endpoint. This fixes the moving-target drain detection issue.
- The drain timeout (10s) is a safety net for edge cases (silence-only replay, Soniox bugs).
- This function must only be called when the WebSocket is connected (from `onReady` callback in `reconnectWithContext`). `SonioxClient.sendAudio` silently drops data when not connected.

**Depends on:** Steps 5, 7.

### Step 9: Modify `resumeSession` to orchestrate replay

**File:** `src/main/session.ts`

Modify the `resumeSession` function (from task 152) to trigger ghost conversion and replay when eligible. Both ghost conversion and replay audio sending happen inside the `onReady` callback — this ensures connection B is confirmed open before the editor is modified, avoiding a de-committed state on connection failure.

```ts
import { reconnectWithContext, beginReplayPhase, sendReplayAudio, isInReplayPhase } from './soniox-lifecycle';
import { getPendingStartMs } from './soniox-lifecycle'; // from task 153

async function resumeSession(): Promise<void> {
  if (status !== 'paused' || resumeInProgress) return;
  resumeInProgress = true;
  info('Session resuming');

  try {
    const { replayAnalysis, editorText } = await getResumeAnalysis();
    if (status !== 'paused') return;

    const editorWasModified = replayAnalysis.eligible || replayAnalysis.blockedReason !== 'none';

    if (editorWasModified) {
      // Compute effective replay start (spec formula)
      const pendingStartMs = getPendingStartMs();
      let effectiveReplayStartMs: number | null = null;

      if (replayAnalysis.eligible) {
        effectiveReplayStartMs = pendingStartMs != null
          ? Math.min(replayAnalysis.replayStartMs!, pendingStartMs)
          : replayAnalysis.replayStartMs;
      } else {
        effectiveReplayStartMs = pendingStartMs ?? null;
      }

      // Determine if replay is feasible
      const canReplay = replayAnalysis.eligible && effectiveReplayStartMs != null;

      if (canReplay) {
        // Full replay: reconnect, then ghost conversion + replay audio on open
        beginReplayPhase();

        const ghostStartMs = replayAnalysis.replayGhostStartMs!;
        const replayStartMs = effectiveReplayStartMs!;

        reconnectWithContext(editorText, {
          replay: {
            replayStartMs,
            replayGhostStartMs: ghostStartMs,
          },
          onReady: () => {
            // Connection B is now open. Safe to convert and replay.
            // 1. Tell renderer to convert clean tail to ghost text.
            //    The renderer processes this synchronously (discrete update).
            //    Soniox hasn't received any audio yet so no tokens will
            //    arrive before the conversion completes.
            sendToRenderer(IpcChannels.SESSION_REPLAY_GHOST_CONVERT, ghostStartMs);

            // 2. Send replay audio to the now-open WebSocket.
            sendReplayAudio(replayStartMs);
          },
        });
      } else {
        // Reconnect without replay (context refresh only)
        reconnectWithContext(editorText);
      }
    } else {
      // No edit — reuse existing connection
      try {
        resumeCapture();
      } catch {
        return;
      }
      status = 'recording';
      sendStatus(status);
    }

    sendToRenderer(IpcChannels.SESSION_RESUMED);
  } finally {
    resumeInProgress = false;
  }
}
```

**Key design decisions:**
- Ghost conversion IPC is sent inside `onReady` (which fires inside `onConnected`), AFTER connection B is confirmed open. This means the editor is only de-committed when we know the connection succeeded. If connection B fails, `onConnected` never fires, and the editor remains unchanged.
- Replay audio is sent immediately after ghost conversion in the same `onReady` callback. Since Soniox hasn't received any audio yet, there's no race — tokens won't arrive at the renderer until well after the ghost conversion IPC is processed (network round-trip to Soniox + processing time >> IPC delivery time).
- `beginReplayPhase()` is called before reconnect so that when mic capture starts (later in `onConnected`, after `onReady`), live audio goes to the local buffer instead of Soniox.
- `canReplay` requires both `eligible` and a computed `effectiveReplayStartMs`. If the ring buffer slice check (done inside `sendReplayAudio`) fails, `endReplayPhase()` is called immediately, flushing any accumulated live audio.
- If connection B fails (network error, API key issue), the session transitions to error state via existing error handling. `beginReplayPhase()` was called but `onReady` never fired, so the ghost conversion never happened. `endReplayPhase()` should be called in the error path to flush any buffered live audio. Add cleanup in the existing error handlers.

**Depends on:** Steps 1, 5, 6, 7, 8; Tasks 152, 153.

### Step 10: Unit tests for `$convertToReplayGhost`

**File:** `src/renderer/overlay/editor/replayGhostConversion.test.ts` (new file)

Follow the test patterns from `analyzeReplayEligibility.test.ts`: `createTestEditor()`, `clean()`/`dirty()` helpers, reading results via `editor.getEditorState().read()`.

Tests:

1. **Removes clean tail nodes from replayGhostStartMs**: Set up paragraph with `[clean("Hello ", 0, 500), dirty("beers", "bears", 500, 1000), clean(" at", 1000, 1500), clean(" the store", 1500, 2500)]`. Call `$convertToReplayGhost(1000)`. Verify `ghostText = " at the store"`, `removedCharCount = 13`. Read editor state and verify only `[clean("Hello "), dirty("beers")]` remain.

2. **Suffix-match: truncates dirty node and folds suffix into ghost**: Set up `[clean("Hello ", 0, 500), dirty("cold beers", "beers", 500, 1000), clean(" at the store", 1000, 2000)]`. Call `$convertToReplayGhost(500)`. Verify `ghostText = "beers at the store"`, `removedCharCount = 18`. Verify editor has `[clean("Hello "), truncated("cold ")]` where the dirty node now has text "cold ".

3. **No nodes to remove: returns empty result**: Set up `[clean("Hello", 0, 500)]`. Call `$convertToReplayGhost(1000)` (no nodes at/after 1000ms). Verify `ghostText = ""`, `removedCharCount = 0`. Editor unchanged.

4. **All clean nodes removed**: Set up `[clean("Hello ", 0, 500), clean("world", 500, 1000)]`. Call `$convertToReplayGhost(0)`. Verify `ghostText = "Hello world"`, `removedCharCount = 11`. Editor paragraph is empty.

5. **Empty editor**: Call `$convertToReplayGhost(0)`. Verify returns `{ ghostText: '', removedCharCount: 0 }`.

6. **Multiple clean tail nodes**: Set up `[dirty("x", "y", 0, 100), clean(" a", 100, 200), clean(" b", 200, 300), clean(" c", 300, 400)]`. Call `$convertToReplayGhost(100)`. Verify `ghostText = " a b c"`, all three clean nodes removed, only dirty("x") remains.

7. **Non-suffix-match dirty node at replayGhostStartMs stays**: Set up `[clean("Hello ", 0, 500), dirty("beers", "bears", 500, 1000), clean(" world", 1000, 2000)]`. Call `$convertToReplayGhost(1000)` (start is at the clean node, not the dirty). Verify only the clean node is removed. `ghostText = " world"`, dirty("beers") remains.

8. **Round-trip: identical re-commit produces same text**: Set up editor, run ghost conversion, then call `commitWords` with the same text/timestamps. Verify editor text matches original.

**Depends on:** Step 3.

### Step 11: Unit tests for `sliceFromWithMeta`

**File:** `src/main/audio-ring-buffer.test.ts` (add to existing test file)

Add tests in a new `describe('sliceFromWithMeta')`:

1. **Returns actual chunk start timestamp**: Push chunks at [0ms, 100ms, 200ms]. Call `sliceFromWithMeta(150)`. Verify `actualStartMs = 100` (last chunk with startMs <= 150).

2. **Returns null when ms before oldest**: Push chunks starting at 100ms (after eviction). Call `sliceFromWithMeta(50)`. Verify null.

3. **Returns null when ms >= currentMs**: Call `sliceFromWithMeta(currentMs)`. Verify null.

4. **Returns data from exact chunk boundary**: Push chunks at [0, 100, 200]. Call `sliceFromWithMeta(100)`. Verify `actualStartMs = 100`, data starts from that chunk.

**Depends on:** Step 5.

### Step 12: Main-process tests for replay orchestration

**File:** `src/main/soniox-lifecycle.test.ts`

Add tests in a new `describe('replay phase')` block:

1. **`beginReplayPhase` causes live audio to buffer**: Start replay phase, call `onAudioData` with a chunk. Verify `soniox.sendAudio` was NOT called for that chunk. Verify `mockRingBufferInstance.push` was still called.

2. **`endReplayPhase` flushes buffered audio**: Begin replay, send 3 audio chunks (buffered). Call `endReplayPhase()`. Verify `soniox.sendAudio` was called 3 times with the buffered chunks, in order.

3. **`sendReplayAudio` sends slice and transitions to draining**: Set up `mockRingBufferInstance.sliceFromWithMeta` to return `{ data: Buffer.alloc(64000), actualStartMs: 980 }`. Call `sendReplayAudio(1000)`. Verify `soniox.sendAudio` was called with the buffer. Verify `replayPhase` is `'draining'`.

4. **`sendReplayAudio` updates `connectionBaseMs` to `actualStartMs`**: Same setup as #3. Verify `connectionBaseMs` is 980 (not the requested 1000).

5. **`sendReplayAudio` ends phase if no audio available**: Set up `mockRingBufferInstance.sliceFromWithMeta` to return null. Call `sendReplayAudio(99999)`. Verify replay phase ends immediately.

6. **Replay draining ends when final tokens cover replay range**: Begin replay, call `sendReplayAudio` with a 2-second slice. Trigger `onFinalTokens` with tokens whose `end_ms` (connection-relative) >= 1950ms (2000ms - 50ms tolerance). Verify `endReplayPhase` is called (live audio flushed).

7. **Drain timeout fallback**: Begin replay, send replay audio. Don't trigger final tokens. Advance timers past `REPLAY_DRAIN_TIMEOUT_MS`. Verify replay phase ends.

**File:** `src/main/session.test.ts`

Add tests in a new `describe('resumeSession with replay')` block:

8. **Triggers ghost conversion IPC when replay eligible**: Set up resume analysis with `eligible: true, replayGhostStartMs: 1000`. Resume. Verify `sendToRenderer` was called with `(SESSION_REPLAY_GHOST_CONVERT, 1000)`.

9. **Sends replay audio via onReady callback**: Verify `sendReplayAudio` is called after `reconnectWithContext`'s `onConnected` fires (not before).

10. **Computes effectiveReplayStartMs from both sources**: Set up with `replayStartMs: 2000` and `pendingStartMs: 1500`. Verify `Math.min(2000, 1500) = 1500` is used as the effective start.

11. **Falls back to no-replay reconnect when ineligible but modified**: Set up resume analysis with `eligible: false, blockedReason: 'dirty-tail'`. Verify plain `reconnectWithContext` is called without replay config.

12. **Normal resume when no edit**: Verify `reconnectWithContext` is NOT called, `resumeCapture` is called.

**Depends on:** Steps 5-9.

### Step 13: Update spec with clarifications

**File:** `spec/proposal-context-refresh.md`

Apply the spec updates:

1. In "Connection handoff" section (step 3), add: "Main sends `SESSION_REPLAY_GHOST_CONVERT` IPC to the renderer with `replayGhostStartMs` before opening connection B. The renderer converts the clean tail to ghost text in a synchronous `historic`-tagged update."

2. In "Prefix/suffix matching" → "Replay is considered complete when:", clarify: "Replay draining is detected by comparing finalized token timestamps against the replay audio duration. A safety timeout (10s) forces completion if the heuristic doesn't trigger. Once draining is complete, buffered post-resume live audio is flushed to the connection."

3. In "Audio ring buffer" section, add: "`sliceFromWithMeta(ms)` returns both the audio data and the `actualStartMs` of the first chunk. `connectionBaseMs` is set to `actualStartMs` (not the requested ms) to account for chunk-boundary alignment."

4. In "What does NOT change" → ghost-text bullet, clarify: "The two sources are temporally exclusive — during replay, live audio is buffered locally and no live non-final tokens arrive. The ghost text CSS property is shared; no structural change to ghost text rendering is needed."

**Depends on:** None.

### Step 14: Run all tests

```bash
npx vitest run \
  src/renderer/overlay/editor/replayGhostConversion.test.ts \
  src/renderer/overlay/editor/analyzeReplayEligibility.test.ts \
  src/main/audio-ring-buffer.test.ts \
  src/main/soniox-lifecycle.test.ts \
  src/main/session.test.ts
```

Verify no regressions in existing tests and all new tests pass.

**Depends on:** Steps 10-12.

## Risks / Open Questions

1. **Dependency chain (blocking):** This task depends on tasks 150, 149, 152, and 153. Tasks 152 and 153 are still in planning. The plan references their planned APIs. If those tasks' implementations diverge from their plans (different function signatures, renamed variables, different IPC patterns), this task's implementation must adapt. The most impactful dependency is task 152's `reconnectWithContext` — this task adds an `options` parameter with `replay` and `onReady` fields.

2. **Ghost conversion timing:** Ghost conversion IPC is sent inside the `onReady` callback, which fires after connection B is confirmed open. If connection B fails, `onReady` never fires and the editor remains unchanged. However, `beginReplayPhase()` was called before reconnect — if the connection fails, `endReplayPhase()` must be called in the error path to flush any buffered live audio and reset state. Verify that the error handler in `reconnectWithContext` calls `endReplayPhase()` (or add it if missing).

3. **Replay drain detection heuristic:** The `lastTokenEndMs >= replayEndRelativeMs - 50` heuristic uses a fixed `replayEndRelativeMs` (computed from replay audio byte count). This is robust against the moving-target issue (ring buffer growing during replay). Edge cases: (a) replay audio is all silence — no tokens produced, drain never triggers, timeout handles it. (b) Soniox produces a final token significantly short of the audio end — 50ms tolerance may not be enough. The 10-second timeout is the safety net.

4. **`connectionBaseMs` update in `sendReplayAudio`:** Step 8 updates `connectionBaseMs` to `slice.actualStartMs` after it was initially set in `reconnectWithContext`. The `onFinalTokens`/`onNonFinalTokens` callbacks capture `baseMs` at construction time (via closure). If `connectionBaseMs` is updated after the callbacks are created, the callbacks use the stale value. **Fix needed:** The callback closures in Step 6 must capture `connectionBaseMs` by reference (reading the module variable), not by value. Verify that the existing code in `reconnectWithContext` (task 152's plan) uses `const baseMs = connectionBaseMs` before creating the client. If so, the `sendReplayAudio` update comes too late. **Resolution:** Move the `connectionBaseMs` update to happen in `reconnectWithContext` BEFORE creating the `SonioxClient`, by passing the actual start as a parameter. Or: have `sendReplayAudio` set a module-level variable that the callbacks read lazily. The cleanest fix: make the `onFinalTokens`/`onNonFinalTokens` callbacks read `connectionBaseMs` directly (not via a captured `baseMs` const). Then `sendReplayAudio` can safely update `connectionBaseMs` at any time.

5. **Post-resume live audio buffering memory:** During replay, live audio is buffered in `postResumeLiveBuffer`. At 32KB/s, a 10-second replay with active speech would buffer ~320KB — negligible. The 10-second drain timeout caps worst-case buffer size.

6. **Undo/redo history invalidation:** The ghost conversion clears undo/redo stacks. If the user made edits during pause and wants to undo them, they can't after replay starts. This is consistent with how `commitWords` handles history — any transcription activity invalidates prior undo states.

7. **BlockManager `applyEdit` side effect:** Using `blockManager.applyEdit(docLen - removedCharCount, removedCharCount, '')` marks the affected block as `modified: true`. This is semantically imprecise (the text wasn't user-edited, it was moved to ghost). When replay re-commits, `commitFinalText` creates new unmodified soniox blocks, so this doesn't affect correctness. If it causes issues, a dedicated `removeTail` method could be added, but that's unnecessary for v1.
