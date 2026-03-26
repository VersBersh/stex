# Context: Audio Replay and Post-Resume Live Audio Buffering

## Relevant Files

### Core implementation targets

- **`src/main/soniox-lifecycle.ts`** — Main lifecycle module that manages Soniox WebSocket connections, audio routing (`onAudioData`), connection handoff (`reconnectWithContext`), and all session-level audio state (`ringBuffer`, `connectionBaseMs`, `pendingStartMs`). This is where replay audio sending, live audio buffering, drain detection, and flushing will be implemented.

- **`src/main/session.ts`** — Session orchestration layer. The `resumeSession()` function requests replay analysis from the renderer, coordinates reconnection, and manages session status. Currently calls `reconnectWithContext(editorText)` on editor modification but does not use `replayAnalysis` or compute `effectiveReplayStartMs`. Must be updated to pass replay information to the lifecycle.

### Supporting modules

- **`src/main/audio-ring-buffer.ts`** — `AudioRingBuffer` class with `push(chunk)`, `sliceFrom(ms)`, `currentMs`, and `oldestMs`. Stores ~5 minutes of PCM audio. `sliceFrom()` uses binary search and returns `null` if the requested range is evicted. Already integrated into `onAudioData`.

- **`src/main/soniox.ts`** — `SonioxClient` WebSocket wrapper. `sendAudio(chunk)` sends PCM to Soniox. `finalize()` sends empty buffer (triggers Soniox connection close via `finalize_on_end: true`). `hasPendingNonFinalTokens` tracks whether the latest response had non-final tokens. `_hasPendingNonFinalTokens` starts as `true` and is updated per-message.

- **`src/main/audio.ts`** — Audio capture module. `startCapture(onData, onError)` sends IPC to renderer to start microphone; throws if already active. `stopCapture()` is idempotent.

- **`src/shared/types.ts`** — Contains `ReplayAnalysisResult` (`eligible`, `replayStartMs`, `replayGhostStartMs`, `blockedReason`) and `ResumeAnalysisResult` (`editorWasModified`, `replayAnalysis`, `editorText`).

- **`src/shared/ipc.ts`** — IPC channel constants including `SESSION_RESUME_ANALYSIS`.

### Renderer (read-only context)

- **`src/renderer/overlay/editor/analyzeReplayEligibility.ts`** — `$analyzeReplayEligibility()` function that inspects the Lexical editor state to determine replay eligibility, `replayStartMs`, and `replayGhostStartMs`. Called by the renderer on resume analysis request.

- **`src/renderer/overlay/OverlayContext.tsx`** — Handles `onRequestResumeAnalysis` IPC, calls `$analyzeReplayEligibility()`, and sends `ResumeAnalysisResult` back to main.

### Test files

- **`src/main/soniox-lifecycle.test.ts`** — Comprehensive test suite for lifecycle module including `reconnectWithContext`, ring buffer integration, timestamp offset, and `pendingStartMs`. Tests must be extended for replay, live buffering, and drain logic.

- **`src/main/audio-ring-buffer.test.ts`** — Tests for `AudioRingBuffer` including `sliceFrom` retrieval.

- **`src/main/session.test.ts`** — Tests for session pause/resume flow including resume analysis integration.

## Architecture

### Audio pipeline

```
Renderer (mic) --IPC--> audio.ts (dataHandler) --> onAudioData() --> ringBuffer.push()
                                                                 --> soniox.sendAudio()
```

Audio flows from the renderer's microphone capture through IPC to `audio.ts`, which dispatches each chunk to `onAudioData()` in `soniox-lifecycle.ts`. Currently, `onAudioData` both stores the chunk in the ring buffer AND sends it directly to the active Soniox WebSocket.

### Pause/resume/reconnect flow (current)

1. **Pause**: `stopCapture()` stops mic, `capturePendingStartMs()` freezes the first non-final token timestamp, finalization drains pending tokens
2. **Resume (no edit)**: `resumeCapture()` restarts mic on existing connection
3. **Resume (with edit)**: `reconnectWithContext(editorText)` closes old connection, opens new with fresh context, sets `connectionBaseMs = ringBuffer.currentMs`, starts capture in `onConnected`

### What's missing (this task)

The current `reconnectWithContext()` does NOT:
- Extract and send replay audio from the ring buffer
- Buffer post-resume live audio during any replay phase
- Detect replay completion / drain
- Flush buffered live audio after replay
- Start mic capture immediately on resume (currently waits for WebSocket connection)
- Compute or use `effectiveReplayStartMs`

### Key constraints

- **`startCapture()` throws if already active** — cannot be called twice; if capture is started before connection, the `onConnected` handler must not start it again
- **`finalize()` closes the connection** — Soniox uses `finalize_on_end: true`, so sending an empty buffer closes the WebSocket. Cannot use finalization mid-stream to mark replay boundary
- **`hasPendingNonFinalTokens` starts as `true`** — set in `SonioxClient` constructor, only updated when Soniox sends a response with tokens. For replay drain detection, this means the condition `!hasPendingNonFinalTokens` won't trigger prematurely
- **Ring buffer timestamps are monotonic session-level** — derived from sample count, not wall-clock time. Safe for replay extraction
- **Token callbacks must continue during replay** — replay tokens need to be forwarded to the renderer for ghost text and commit
