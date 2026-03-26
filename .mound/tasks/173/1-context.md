# Context

## Relevant Files

- `src/main/soniox-lifecycle.ts` — Core lifecycle management for Soniox connections. Contains `sendReplayAudio()`, the drain detection heuristic in `onFinalTokens`, the `REPLAY_DRAIN_TIMEOUT_MS` safety timeout, and `endReplayPhase()`.
- `src/main/soniox-lifecycle.test.ts` — Unit tests for soniox-lifecycle. Currently lacks replay/drain tests (task 172 is about adding those).
- `spec/proposal-context-refresh.md` — Spec for context refresh including replay completion semantics and drain detection description.

## Architecture

The replay system handles re-transcription after a context refresh. When a user edits committed text, the system:

1. Opens a new Soniox connection (B) with corrected context
2. Replays buffered audio from the ring buffer to B (`sendReplayAudio`)
3. Waits for Soniox to process (drain) the replay audio before resuming normal live streaming

**Drain detection** works via a heuristic in `reconnectWithContext`'s `onFinalTokens` handler: when the last finalized token's `end_ms` reaches within 50ms of `replayEndRelativeMs` (the computed replay audio duration), draining is considered complete. A 10-second safety timeout (`REPLAY_DRAIN_TIMEOUT_MS`) forces completion if the heuristic never triggers.

**The bug**: When replay audio contains only silence, Soniox produces zero final tokens. The drain heuristic check (`tokens.length > 0` gate at line 418) never fires, so the system waits the full 10 seconds unnecessarily.

**State machine**: `replayPhase` transitions through `'idle'` → `'replaying'` → `'draining'` → `'idle'`. The drain timer and zero-token timer both need cleanup in `endReplayPhase()` and `resetLifecycle()`.
