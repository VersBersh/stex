# Plan — Task 152: Connection Handoff on Resume

## Goal

On resume after editor modification, close the old Soniox connection and open a new one with the current editor text as `context.text`, setting `connectionBaseMs` appropriately so token timestamps remain in session audio time.

## Steps

### Step 1: Add `ReplayAnalysisResult` to shared types

**File:** `src/shared/types.ts`

Add the `ReplayAnalysisResult` interface (currently defined only in the renderer at `src/renderer/overlay/editor/analyzeReplayEligibility.ts`):

```ts
export interface ReplayAnalysisResult {
  eligible: boolean;
  replayStartMs: number | null;
  replayGhostStartMs: number | null;
  blockedReason: 'none' | 'paragraph-boundary' | 'dirty-tail' | 'too-far-from-end';
}
```

Also add a combined result type for the resume analysis IPC:

```ts
export interface ResumeAnalysisResult {
  replayAnalysis: ReplayAnalysisResult;
  editorText: string;
}
```

**Then** update `src/renderer/overlay/editor/analyzeReplayEligibility.ts` to import `ReplayAnalysisResult` from `../../../shared/types` instead of defining it locally. Remove the local interface definition. Keep the `PROXIMITY_THRESHOLD_CHARS` constant and the `ClassifiedLeaf` interface (these are implementation details, not shared).

### Step 2: Add IPC channel for resume analysis

**File:** `src/shared/ipc.ts`

Add a new channel constant:

```ts
SESSION_RESUME_ANALYSIS: 'session:resume-analysis',
```

This channel is bidirectional (same pattern as `SESSION_CONTEXT`): main sends a request, renderer responds on the same channel with `ResumeAnalysisResult`.

### Step 3: Extend preload API

**File:** `src/shared/preload.d.ts`

Add to the `ElectronAPI` interface:

```ts
// Send (Renderer → Main, fire-and-forget)
sendResumeAnalysis(result: ResumeAnalysisResult): void;

// Listen (Main → Renderer, push events)
onRequestResumeAnalysis(callback: () => void): () => void;
```

Import `ResumeAnalysisResult` from `./types`.

**File:** `src/preload/index.ts`

Add the implementations following the existing pattern:

```ts
sendResumeAnalysis: (result: ResumeAnalysisResult) =>
  ipcRenderer.send(IpcChannels.SESSION_RESUME_ANALYSIS, result),
```

```ts
onRequestResumeAnalysis: (callback: () => void) => {
  const handler = () => callback();
  ipcRenderer.on(IpcChannels.SESSION_RESUME_ANALYSIS, handler);
  return () => { ipcRenderer.removeListener(IpcChannels.SESSION_RESUME_ANALYSIS, handler); };
},
```

Import `ResumeAnalysisResult` from `../shared/types`.

### Step 4: Wire resume analysis handler in renderer

**File:** `src/renderer/overlay/OverlayContext.tsx`

Add a new `useEffect` block (after the existing context text handler, ~line 201) that listens for resume analysis requests. Follow the exact pattern of the context text handler:

```ts
useEffect(() => {
  return window.api.onRequestResumeAnalysis(() => {
    const editor = editorRef.current;
    if (!editor) {
      window.api.sendResumeAnalysis({
        replayAnalysis: { eligible: false, replayStartMs: null, replayGhostStartMs: null, blockedReason: 'none' },
        editorText: '',
      });
      return;
    }
    editor.getEditorState().read(() => {
      const replayAnalysis = $analyzeReplayEligibility();
      const editorText = $getDocumentText();
      window.api.sendResumeAnalysis({ replayAnalysis, editorText });
    });
  });
}, []);
```

Add import for `$analyzeReplayEligibility` from `./editor/analyzeReplayEligibility`.

### Step 5: Add `reconnectWithContext()` to soniox-lifecycle

**File:** `src/main/soniox-lifecycle.ts`

**Dependency:** This step requires task 150's changes to be present: `connectionBaseMs` variable and `applyTimestampOffset()` function. Task 150 is a declared dependency of task 152. The implementation must rebase onto task 150's merged changes before proceeding. If task 150 is not yet merged at implementation time, this step blocks.

Add a new exported function. This is the core of the connection handoff — it closes the old connection and opens a new one with fresh context, without resetting the ring buffer.

```ts
export function reconnectWithContext(contextText: string): void {
  if (!activeCallbacks) return;

  info('Reconnecting with fresh context (%d chars)', contextText.length);

  // Close old connection (no audio flowing during pause, no finalization needed)
  soniox?.disconnect();
  soniox = null;

  // Set connectionBaseMs to current session audio time
  // connectionBaseMs is introduced by task 150; this is the first place it's set to non-zero
  connectionBaseMs = ringBuffer?.currentMs ?? 0;

  // Update stored context for any future network-error reconnects
  storedContextText = contextText;

  // Reset per-connection state (but NOT the ring buffer)
  audioChunkCount = 0;
  awaitingFinalization = false;
  levelMonitor = createAudioLevelMonitor();
  const settings = getSettings();
  soundEventDetector = createSoundEventDetector(settings.silenceThresholdDb);

  const callbacks = activeCallbacks;

  soniox = new SonioxClient({
    onConnected: () => {
      info('Soniox reconnected with fresh context, starting audio capture');
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
      callbacks.onFinalTokens(applyTimestampOffset(tokens, connectionBaseMs));
    },
    onNonFinalTokens: (tokens: SonioxToken[]) => {
      callbacks.onNonFinalTokens(applyTimestampOffset(tokens, connectionBaseMs));
    },
    onFinished: () => {
      callbacks.onFinalizationComplete();
    },
    onDisconnected: (code: number, reason: string) => {
      handleDisconnect(code, reason);
    },
    onError: (err: Error) => {
      error('Soniox error during context reconnect: %s', err.message);
      stopCapture();
      callbacks.onAudioLevel?.(MIN_DB);
      callbacks.onStatusChange('error');
      callbacks.onError({ type: 'unknown', message: err.message });
    },
  });

  soniox.connect(settings, contextText);
}
```

**Key design decisions:**
- Ring buffer is NOT reset — it persists across the reconnect for future replay use
- `connectionBaseMs` is set to `ringBuffer.currentMs` (= `sessionAudioEndMsAtResume`), since this task doesn't implement replay
- `storedContextText` is updated so that if a network-error reconnect happens later, it uses the fresh context
- The `onConnected` callback starts audio capture — this is the same pattern as `connectSoniox()`
- Token callbacks apply `applyTimestampOffset` with the new `connectionBaseMs` (from task 150)
- Error handling mirrors `connectSoniox()`

**Known limitation — delayed mic capture:** The spec (`proposal-context-refresh.md` steps 10-12) calls for immediate mic capture on resume with local buffering of audio during the reconnect. This task does NOT implement local audio buffering — mic capture begins only after the new WebSocket connects (~100-500ms). Audio during the reconnect gap is lost. This is an intentional simplification: the task description scopes out replay and ghost-text conversion, and local audio buffering is the infrastructure that supports those features. Task 154 (replay) will add the buffering. For the v1 reconnect flow, the brief gap is acceptable — the user has just finished editing and likely hasn't started speaking yet.

### Step 6: Add `getResumeAnalysis()` helper to session.ts

**File:** `src/main/session.ts`

Add a private async function following the same pattern as `getEditorContextText()`:

```ts
const RESUME_ANALYSIS_TIMEOUT_MS = 1000;

function getResumeAnalysis(): Promise<ResumeAnalysisResult> {
  return new Promise<ResumeAnalysisResult>((resolve) => {
    const handler = (_event: unknown, result: ResumeAnalysisResult) => {
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      ipcMain.removeListener(IpcChannels.SESSION_RESUME_ANALYSIS, handler);
      warn('Resume analysis timed out after %dms, treating as no edit', RESUME_ANALYSIS_TIMEOUT_MS);
      resolve({
        replayAnalysis: { eligible: false, replayStartMs: null, replayGhostStartMs: null, blockedReason: 'none' },
        editorText: '',
      });
    }, RESUME_ANALYSIS_TIMEOUT_MS);

    ipcMain.once(IpcChannels.SESSION_RESUME_ANALYSIS, handler);
    sendToRenderer(IpcChannels.SESSION_RESUME_ANALYSIS);
  });
}
```

The timeout fallback returns `blockedReason: 'none'` (= no edit detected), so normal resume proceeds. This matches the conservative approach — don't reconnect if we can't get the analysis.

Add import for `ResumeAnalysisResult` from `../shared/types`.

### Step 7: Modify `resumeSession()` to handle reconnection

**File:** `src/main/session.ts`

Change `resumeSession` from synchronous to async. Add a module-level `resumeInProgress` flag to prevent re-entrant calls during the async analysis round-trip.

```ts
let resumeInProgress = false;

async function resumeSession(): Promise<void> {
  if (status !== 'paused' || resumeInProgress) return;
  resumeInProgress = true;
  info('Session resuming');

  try {
    // Request resume analysis from renderer
    const { replayAnalysis, editorText } = await getResumeAnalysis();

    // Check if session was cancelled during the await (e.g. user dismissed overlay)
    if (status !== 'paused') return;

    // Determine if editor was modified
    const editorWasModified = replayAnalysis.eligible || replayAnalysis.blockedReason !== 'none';

    if (editorWasModified) {
      info('Editor modified during pause, reconnecting with fresh context (%d chars)', editorText.length);
      reconnectWithContext(editorText);
      // reconnectWithContext's onConnected callback starts capture and sets status to 'recording'
    } else {
      // No edit — reuse existing connection, just resume capture
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

Add import for `reconnectWithContext` from `./soniox-lifecycle`.

Reset `resumeInProgress = false` in `initSessionManager()` alongside the other resets.

**Key changes from the old `resumeSession()`:**
- Now `async` — awaits the resume analysis IPC round-trip
- `resumeInProgress` flag prevents re-entrant calls (e.g., rapid resume clicks). The flag is set before the await and cleared in `finally`. The status check alone is insufficient because status remains `paused` during the async gap.
- Guards against status change during await (e.g., user dismisses while analysis is pending)
- Branches on `editorWasModified`: reconnect path vs normal resume path
- For reconnect: `reconnectWithContext` handles everything (close, open, start capture on connect)
- For normal resume: existing behavior unchanged
- `SESSION_RESUMED` is sent in both paths (renderer needs to know session is active)

**Status management for the reconnect path:** When `reconnectWithContext` is called, the status transitions are:
- Status remains `paused` until `onConnected` fires (or until error)
- `onConnected` → `callbacks.onStatusChange('recording')` → status becomes `recording`
- If connection fails → status becomes `error`

The renderer receives `SESSION_RESUMED` immediately, which tells it the pause period is over and it should re-enable the pause button. The actual `recording` status follows once the WebSocket connects. This brief transient is acceptable — similar to the initial connection flow where `connecting` precedes `recording`.

### Step 8: Reset `resumeInProgress` in `initSessionManager()`

**File:** `src/main/session.ts`

In `initSessionManager()`, add `resumeInProgress = false;` alongside the other resets:

```ts
export function initSessionManager(): void {
  resetLifecycle();
  status = 'idle';
  activeTransition = null;
  currentFinalizationResolver = null;
  resumeInProgress = false;
  // ...
}
```

This ensures the flag doesn't carry stale state across session manager re-initializations.

### Step 9: Add unit tests for `reconnectWithContext`

**File:** `src/main/soniox-lifecycle.test.ts`

Add a new `describe('reconnectWithContext')` block. Import `reconnectWithContext` from `./soniox-lifecycle`.

**Test mock note:** The existing test harness uses a single shared `mockSonioxInstance` that captures the events from the most recently constructed `MockSonioxClient`. When `reconnectWithContext` creates a new client, the mock's `_events` are replaced with the new client's callbacks, and `connect.mockClear()` resets. This means we can test the new connection's behavior naturally — trigger `onConnected` on `mockSonioxInstance` after the reconnect, and it invokes the new client's callback. However, we cannot directly assert "disconnect was called on the *old* client" vs the new one. Instead, assert on observable behavior: `disconnect` was called before `connect`, and the connect call received the expected context text.

Tests:

1. **Disconnects old client and connects new one with context**: Connect, trigger connected, call `reconnectWithContext('corrected text')`. Verify `mockSonioxInstance.disconnect` was called. Verify `mockSonioxInstance.connect` was called with `(settings, 'corrected text')`.

2. **Starts audio capture on new connection's connected event**: Call `reconnectWithContext('text')`, trigger `onConnected` on the mock. Verify `mockAudio.startCapture` was called.

3. **Sets status to recording after reconnect**: Call `reconnectWithContext('text')`, trigger `onConnected`. Verify `callbacks.onStatusChange` was called with `'recording'`.

4. **Preserves ring buffer across reconnect**: Connect, trigger connected, send audio to populate ring buffer. Call `reconnectWithContext('text')`. Verify `mockRingBufferInstance.clear` was NOT called. Verify `MockAudioRingBuffer` was NOT called again (no new instance created).

5. **Updates stored context text for future network reconnects**: Call `reconnectWithContext('fresh')`. Trigger a network disconnect on the new connection. Advance timers past reconnect delay. Verify the auto-reconnect uses `'fresh'` as context text.

6. **Does nothing if no active callbacks**: Call `resetLifecycle()` first, then call `reconnectWithContext('text')`. Verify no SonioxClient was created.

7. **Handles audio capture error on reconnected connection**: Call `reconnectWithContext('text')`, mock `startCapture` to throw. Trigger `onConnected`. Verify status becomes `'error'`.

### Step 10: Add unit tests for session resume with reconnection

**File:** `src/main/session.test.ts`

Add a new `describe('resumeSession with context refresh')` block inside the existing test structure.

The test setup needs to mock the `SESSION_RESUME_ANALYSIS` IPC round-trip. Following the existing pattern (see how `SESSION_CONTEXT` is mocked in the session tests): when the mock `webContents.send` is called with `SESSION_RESUME_ANALYSIS`, simulate the renderer responding by invoking the matching `ipcMain.once` handler with a `ResumeAnalysisResult`.

Also mock `reconnectWithContext` from `./soniox-lifecycle`. The existing test file already mocks `soniox-lifecycle` — add `reconnectWithContext` to the mock.

Tests:

1. **Normal resume when no edit (blockedReason: 'none')**: Simulate resume analysis returning `{ eligible: false, blockedReason: 'none' }`. Verify `reconnectWithContext` was NOT called. Verify `resumeCapture` was called (existing behavior).

2. **Reconnects when editor was modified (eligible: true)**: Simulate resume analysis returning `{ eligible: true, replayStartMs: 5000, blockedReason: 'none' }` with `editorText: 'corrected text'`. Verify `reconnectWithContext` was called with `'corrected text'`. Verify `resumeCapture` was NOT called directly.

3. **Reconnects when editor was modified (blockedReason: 'dirty-tail')**: Similar to above but with `{ eligible: false, blockedReason: 'dirty-tail' }`. Verify reconnect.

4. **Reconnects when editor was modified (blockedReason: 'too-far-from-end')**: Verify reconnect.

5. **Sends SESSION_RESUMED in both paths**: Verify `SESSION_RESUMED` is sent to renderer for both reconnect and normal resume paths.

6. **Timeout falls back to normal resume**: Don't respond to the `SESSION_RESUME_ANALYSIS` IPC. Advance timers past `RESUME_ANALYSIS_TIMEOUT_MS`. Verify normal resume path (no reconnect).

7. **Guards against status change during analysis**: Start resume, then change status to non-paused before the analysis resolves. Verify neither `reconnectWithContext` nor `resumeCapture` is called.

8. **Prevents re-entrant resume**: Call `resumeSession()` twice without resolving the first analysis. Verify only one analysis request is sent.

### Step 11: Verify no regression

Run the full test suite:

```bash
npx vitest run src/main/soniox-lifecycle.test.ts src/main/session.test.ts src/renderer/overlay/editor/analyzeReplayEligibility.test.ts
```

All existing tests should pass unchanged:
- The normal pause/resume path (no edit) follows the same code path — `resumeSession` requests analysis, gets `blockedReason: 'none'`, and calls `resumeCapture()` as before
- `analyzeReplayEligibility` tests are unaffected (type import location changes but behavior is identical)
- Lifecycle tests are unaffected (new function doesn't change existing ones)

## Risks / Open Questions

1. **Task 150 dependency (blocking)**: `reconnectWithContext` directly sets `connectionBaseMs` and uses `applyTimestampOffset`, both introduced by task 150 (currently `implementing`). This is a declared dependency — the implementation must rebase onto task 150's merged changes. If task 150's implementation diverges from its plan (e.g., different variable name, offset function not exported), the implementation must adapt. The plan references task 150's planned API: `let connectionBaseMs` module variable, exported `applyTimestampOffset(tokens, offsetMs)` function.

2. **Delayed mic capture (intentional v1 limitation)**: The spec (`proposal-context-refresh.md` steps 10-12) calls for immediate mic capture on resume with local buffering of captured audio during the reconnect. This task does NOT implement local audio buffering — mic capture begins only after the new WebSocket connects (~100-500ms gap). Audio during the gap is lost. This is intentional: the task description scopes out replay and ghost-text conversion. Local audio buffering is the infrastructure that supports replay (task 154). For v1, the brief gap is acceptable — the user has just finished editing text and likely hasn't started speaking yet. The ring buffer continues accumulating once capture restarts.

3. **Async resume latency**: The new `resumeSession` adds an IPC round-trip (~1-10ms on Electron) before any action is taken. This is a minor delay that users won't notice. The timeout (`RESUME_ANALYSIS_TIMEOUT_MS = 1000`) is a safety net for renderer hangs — in practice, the response should arrive in <10ms since `$analyzeReplayEligibility` and `$getDocumentText` are synchronous reads of in-memory Lexical state.

4. **Status during reconnect**: Between `reconnectWithContext()` call and `onConnected` firing, status is still `paused`. The renderer receives `SESSION_RESUMED` but status hasn't changed to `recording` yet. This is a brief transient state (~100-500ms for WebSocket connect). If this causes UI issues, a future task could add a transient `connecting` status for the context-refresh path, but this is unlikely to be noticeable.

5. **`editorWasModified` false positives**: Any dirty node triggers reconnection, even if the edit happened during recording (not during pause). This is by design — the current connection's context is stale regardless of when the edit happened. Reconnecting refreshes context for better future transcription. The cost is a brief reconnection delay.

6. **Replay not implemented yet**: This task sets `connectionBaseMs = sessionAudioEndMsAtResume` in all cases. When task 154 (replay) is implemented, it will need to set `connectionBaseMs = replayStartMs` when replay is eligible. The `reconnectWithContext` function may need a parameter for this. The current design keeps it simple — future tasks can extend.

7. **`ReplayAnalysisResult` type move**: Moving the type from `analyzeReplayEligibility.ts` to `shared/types.ts` is a cross-boundary change. If the renderer's file is modified concurrently by another task, there could be a merge conflict. Low risk since the change is mechanical.

8. **Test mock single-instance pattern**: The lifecycle test harness uses one shared `mockSonioxInstance` whose callbacks are replaced each time `new MockSonioxClient()` is called. This means we can't directly assert which *instance* received disconnect vs connect. Tests should assert on call order and arguments rather than instance identity.
