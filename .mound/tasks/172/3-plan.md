# Plan

## Goal

Add dedicated replay integration tests to `soniox-lifecycle.test.ts` and `session.test.ts` covering the full replay flow: state transitions, audio buffering, drain detection edge cases, ghost conversion IPC timing, and effectiveReplayStartMs computation.

## Steps

### Step 1: Add replay state and buffering tests to soniox-lifecycle.test.ts

Add `endReplayPhase` to the import statement at line 92.

Add a new `describe('replay — state transitions and audio buffering')` block after the existing `replay drain — zero-token timeout` block (after line 948). Use the same `beforeEach` pattern as the drain tests (fake timers, mock ring buffer, mock disconnect). Tests:

1. **`beginReplayPhase sets isInReplayPhase to true`**: Call `beginReplayPhase()`, assert `isInReplayPhase()` returns true.

2. **`audio chunks are buffered during replay instead of sent to Soniox`**: Connect, trigger connected, `beginReplayPhase()`, get `onAudioData` from `mockAudio.startCapture.mock.calls[0][0]`, push chunks. Assert `mockRingBufferInstance.push` was called (ring buffer still receives data), but `mockSonioxInstance.sendAudio` was NOT called for those chunks.

3. **`buffered live audio is flushed to Soniox when replay ends while connected`**: Connect, trigger connected, set up replay drain flow (beginReplayPhase → reconnectWithContext with onReady → triggerOnConnected → sendReplayAudio). Push live audio chunks via the NEW onAudioData callback (from the reconnected client's startCapture). Trigger drain completion (send final tokens past threshold). Assert `mockSonioxInstance.sendAudio` was called with each buffered chunk after the replay-slice send.

4. **`buffered live audio is discarded when replay ends while disconnected`**: Same setup but mock `mockSonioxInstance.connected = false` before drain completes. Assert buffered chunks are NOT sent after drain.

5. **`sendReplayAudio handles null slice gracefully`**: Mock `sliceFromWithMeta` to return null, call `beginReplayPhase()` then set up reconnect + triggerOnConnected. Assert `isInReplayPhase()` is false (immediately ended) and replay `sendAudio` was not called.

6. **`sendReplayAudio handles empty slice gracefully`**: Mock `sliceFromWithMeta` to return `{ data: Buffer.alloc(0), actualStartMs: 0 }`. Assert same as above.

7. **`sendReplayAudio updates connectionBaseMs from actualStartMs`**: Mock `sliceFromWithMeta` to return `{ data: Buffer.alloc(64000), actualStartMs: 3000 }`. Set up replay, trigger drain completion. Then send new final tokens (connection-relative start_ms=100). Assert `callbacks.onFinalTokens` receives tokens offset by 3000 (i.e., start_ms=3100).

8. **`disconnect during replay calls endReplayPhase`**: Set up replay via `reconnectWithContext` with replay config + onReady, trigger connected, enter draining phase. Trigger disconnect. Assert `isInReplayPhase()` is false.

9. **`error during replay calls endReplayPhase`**: Same setup, trigger error instead of disconnect. Assert `isInReplayPhase()` is false.

### Step 2: Add replay flow tests to session.test.ts

Add `isInReplayPhase` to the import from `./soniox-lifecycle` at line 139.

Add a new `describe('replay flow')` block inside the `resumeSession with context refresh` describe (after the existing tests). Use the existing `respondToResumeAnalysis()` helper.

Create an async helper `startAndPauseWithAudio()` that:
1. Starts a session (`requestToggle()`, `triggerOnConnected()`)
2. Gets the `onAudioData` callback from `mockAudio.startCapture.mock.calls[0][0]`
3. Pushes deterministic audio chunks (e.g., 50 chunks of 3200 bytes = 50 × 100ms = 5000ms of audio at 16kHz/16-bit)
4. Triggers non-final tokens to set up `pendingStartMs` (optional, controlled by parameter)
5. Pauses (`triggerPauseIpc()`, `triggerOnFinished()`)
6. Waits for SESSION_PAUSED, clears mocks

Tests:

1. **`sends ghost conversion IPC after connection B opens`**: `startAndPauseWithAudio()`, resume with eligible replay (`replayGhostStartMs: 2000`), trigger connected on new client. Assert `mockOverlayWindow.webContents.send` was called with `(IpcChannels.SESSION_REPLAY_GHOST_CONVERT, 2000)`.

2. **`sends replay audio via sendAudio after connection B opens`**: Same setup. Assert `mockSonioxInstance.sendAudio` was called (replay audio slice sent).

3. **`ghost conversion IPC fires before replay audio send`**: Use `vi.fn().mockImplementation()` or check `invocationCallOrder` on the respective mock calls. Both `sendToRenderer(SESSION_REPLAY_GHOST_CONVERT, ...)` and `sendReplayAudio(...)` happen in the same synchronous `onReady` callback (session.ts:205-208), so `webContents.send` for ghost convert is called before `sendAudio` for replay. Assert that the `webContents.send` call for `SESSION_REPLAY_GHOST_CONVERT` has a lower `invocationCallOrder` than the `sendAudio` call for the replay buffer.

4. **`effectiveReplayStartMs uses pendingStartMs when it is earlier than replayStartMs`**: Use `startAndPauseWithAudio()` with non-final tokens at `start_ms: 500` (sets `pendingStartMs = 500`). Resume with `replayStartMs: 3000, eligible: true`. After connection B opens, verify the token offset: send final tokens with `start_ms: 100` on connection B. The tokens should be offset by `effectiveReplayStartMs` (which came from the ring buffer's `actualStartMs` — in this case the real ring buffer returns the chunk boundary at or before 500ms). Since the real ring buffer is used in session.test.ts, the offset depends on `actualStartMs` from `sliceFromWithMeta(500)`. With 3200-byte chunks (100ms each), the first chunk starts at 0ms, chunk at index 5 starts at 500ms, so `actualStartMs = 500`. Tokens arrive with `start_ms: 100` → offset to `500 + 100 = 600`. Assert `TOKENS_FINAL` was sent with `start_ms: 600`.

5. **`replay-ineligible resume with editorWasModified does fresh reconnect without replay`**: Resume with `eligible: false, blockedReason: 'dirty-tail', editorWasModified: true`. Assert `mockSonioxInstance.connect` was called (fresh reconnect) but `isInReplayPhase()` is false and `SESSION_REPLAY_GHOST_CONVERT` was NOT sent.

## Risks / Open Questions

1. **Ring buffer chunk boundaries**: The real `AudioRingBuffer` in session.test.ts stores chunks with computed `startMs`. With 3200-byte chunks at 16kHz/16-bit, each chunk is exactly 100ms. This makes `sliceFromWithMeta` deterministic for known `fromMs` values that align with chunk boundaries.

2. **Cross-mock ordering (test 3)**: Vitest's `vi.fn()` provides `mock.invocationCallOrder` which is a global counter, making cross-spy ordering comparisons reliable.

3. **Existing test coverage overlap**: The existing `replay drain — zero-token timeout` tests cover drain detection. New soniox-lifecycle tests focus on: state transitions, audio buffering/flush, connectionBaseMs update, disconnect/error during replay. The session.test.ts tests focus on: ghost IPC timing, effectiveReplayStartMs computation, end-to-end replay flow.
