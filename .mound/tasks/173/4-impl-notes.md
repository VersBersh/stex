# Implementation Notes

## Files modified

- `src/main/soniox-lifecycle.ts` — Added `REPLAY_ZERO_TOKEN_TIMEOUT_MS` constant (3000ms), `replayZeroTokenTimer` variable, zero-token timer setup in `sendReplayAudio()`, timer cancellation in both `onFinalTokens` and `onNonFinalTokens` when tokens arrive during drain, timer cleanup in `endReplayPhase()` and `resetLifecycle()`
- `src/main/soniox-lifecycle.test.ts` — Extended `mockRingBufferInstance` with `sliceFromWithMeta` mock, added imports for `beginReplayPhase`/`sendReplayAudio`/`isInReplayPhase`, added 5 tests in `describe('replay drain — zero-token timeout')`
- `spec/proposal-context-refresh.md` — Added documentation for the 3-second zero-token fast path in the replay draining paragraph

## Deviations from plan

- Used timer-clearing approach (from plan review feedback) instead of a flag variable. When final tokens arrive during drain, `replayZeroTokenTimer` is cleared directly rather than setting a `drainReceivedFinalTokens` flag. This is simpler and avoids an extra module-level variable.
- Added zero-token timer cancellation in `onNonFinalTokens` handler (from code review feedback). Non-final tokens also indicate speech is being processed, so the silence-only fast path should not fire when non-final tokens arrive.

## New tasks or follow-up work

None discovered.
