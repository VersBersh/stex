# Context — Task 153: Capture pendingStartMs at pause time

## Relevant Files

- `src/main/soniox-lifecycle.ts` — Lifecycle layer managing the SonioxClient. Owns module-level state (connection, ring buffer, callbacks). This is where `pendingStartMs` will be tracked and where non-final token data needs to be captured.
- `src/main/soniox.ts` — `SonioxClient` class. Parses WebSocket messages, separates final/non-final tokens, exposes `hasPendingNonFinalTokens` boolean. Fires `onNonFinalTokens` and `onFinalTokens` callbacks.
- `src/main/session.ts` — Session manager. Orchestrates pause/resume. Calls `finalizeSoniox()` on pause, waits for finalization, then sends `SESSION_PAUSED`. On resume, calls `resumeCapture()`. This is where `pendingStartMs` will be consumed to compute `effectiveReplayStartMs`.
- `src/main/audio-ring-buffer.ts` — Ring buffer storing timestamped audio chunks. `currentMs` gives the session audio position.
- `src/shared/types.ts` — Shared types including `SonioxToken` (with `start_ms`, `end_ms`, `is_final`).
- `src/shared/ipc.ts` — IPC channel constants.
- `src/main/soniox-lifecycle.test.ts` — Tests for the lifecycle module.
- `src/main/session.test.ts` — Tests for the session module.
- `spec/proposal-context-refresh.md` — Design spec describing the pendingStartMs concept, its role in the effective replay start calculation, and the overall pause-edit-resume flow.
- `.mound/tasks/150/3-plan.md` — Plan for task 150 (connectionBaseMs tracking). Task 153 depends on `connectionBaseMs` being available to convert connection-relative token timestamps to session audio time.

## Architecture

### Soniox Token Pipeline

Audio flows: `AudioCapture → AudioRingBuffer → SonioxClient (WebSocket)`. Soniox returns token messages containing both final and non-final tokens. `SonioxClient` classifies them and fires callbacks. The lifecycle layer (`soniox-lifecycle.ts`) receives these callbacks and forwards them (soon with `connectionBaseMs` offset per task 150) to the session layer, which sends them to the renderer via IPC.

### Non-Final Token State

Currently, only a boolean `hasPendingNonFinalTokens` is tracked by `SonioxClient`. The lifecycle layer does not retain the actual non-final token data — it forwards tokens to the session layer and discards them. To capture `pendingStartMs`, the lifecycle layer must start tracking the `start_ms` of the most recent batch of non-final tokens.

### Pause Flow (current)

1. `session.ts:pauseSession()` stops audio capture
2. If connected and `hasPendingNonFinalTokens()`, calls `finalizeSoniox()` (sends empty buffer)
3. Waits for `onFinalizationComplete` (up to 5s timeout)
4. Sends `SESSION_PAUSED` to renderer

### Key Timing Concepts

- **Connection time**: Soniox token `start_ms`/`end_ms`, starts at 0 for each new WebSocket connection
- **Session audio time**: Monotonic across the entire session. `connectionBaseMs + token.start_ms` = session audio time
- Task 150 introduces `connectionBaseMs` and `applyTimestampOffset()`. Task 153 reads the offset value to store `pendingStartMs` in session audio time.

### Where pendingStartMs Fits

At pause time, if non-final tokens exist, capture `start_ms` of the first one (already in session audio time after task 150's offset). This value persists across the pause period. At resume, the main process combines it with the renderer's `replayStartMs` to determine the effective audio replay range.
