# Context

## Relevant Files

- `src/main/soniox-lifecycle.ts` — Core replay functions: `beginReplayPhase`, `endReplayPhase`, `sendReplayAudio`, `isInReplayPhase`. Manages replay state machine (`idle` → `replaying` → `draining` → `idle`), live audio buffering during replay, drain detection heuristics, and timer management.
- `src/main/soniox-lifecycle.test.ts` — Existing tests for soniox-lifecycle. Has hoisted mocks for SonioxClient, audio, settings, ring buffer. Already has a `replay drain — zero-token timeout` describe block (lines 844–948) covering drain detection. Missing tests for: beginReplayPhase state transitions, live audio buffering, buffer flush/discard, sendReplayAudio with no data, connectionBaseMs update from replay, disconnect/error during replay.
- `src/main/session.ts` — Session manager with `resumeSession` flow that computes `effectiveReplayStartMs`, calls `beginReplayPhase`, `reconnectWithContext` with replay config, and fires `SESSION_REPLAY_GHOST_CONVERT` IPC + `sendReplayAudio` in the `onReady` callback.
- `src/main/session.test.ts` — Existing session tests. Has `resumeSession with context refresh` describe block that tests basic reconnect scenarios. Missing tests for: ghost conversion IPC timing, replay audio send on connection B, effectiveReplayStartMs computation with pendingStartMs.
- `src/main/audio-ring-buffer.ts` — Ring buffer implementation. `sliceFromWithMeta(ms)` returns `{ data: Buffer, actualStartMs: number }` or null. Used by `sendReplayAudio`.
- `src/shared/ipc.ts` — IPC channel constants including `SESSION_REPLAY_GHOST_CONVERT`.
- `src/main/renderer-send.ts` — `sendToRenderer` function that sends IPC to renderer via `overlayWindow.webContents.send`.

## Architecture

The replay subsystem enables re-transcription of buffered audio after a pause/resume cycle where the user edited the editor text. The flow is:

1. **Pause**: `capturePendingStartMs()` snapshots the start time of any unfinalized non-final tokens. `finalizeSoniox()` drains pending tokens. Connection A stays open but idle.

2. **Resume analysis**: Renderer analyzes whether the editor was modified and whether replay is eligible (clean tail, not too far from end, no paragraph boundary).

3. **effectiveReplayStartMs**: Computed as `Math.min(replayAnalysis.replayStartMs, pendingStartMs)` when both are available, to capture more audio for re-transcription. Falls back to just `replayStartMs` or `pendingStartMs`.

4. **Replay phase**: `beginReplayPhase()` sets `replayPhase = 'replaying'` and clears buffers. `reconnectWithContext` opens connection B with replay config, setting `connectionBaseMs = replayStartMs`.

5. **onReady callback**: After connection B opens, fires `SESSION_REPLAY_GHOST_CONVERT` IPC (renderer converts clean tail to ghost text), then calls `sendReplayAudio(replayStartMs)` which reads from the ring buffer via `sliceFromWithMeta`, sends the audio, transitions to `draining` phase, and starts two timers.

6. **Drain detection**: Three mechanisms — (a) normal drain heuristic: final token `end_ms >= replayEndRelativeMs - 50`, (b) zero-token fast path: 3s timeout when no tokens arrive, (c) 10s safety timeout as ultimate fallback. Both final and non-final tokens cancel the zero-token timer.

7. **endReplayPhase**: Clears timers, flushes buffered live audio chunks to Soniox if connected, resets state.

8. **Live audio buffering**: While in replay phase, `onAudioData` buffers chunks in `postResumeLiveBuffer` instead of sending to Soniox. These are flushed on `endReplayPhase`.
