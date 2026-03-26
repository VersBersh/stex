# SONIOX: Add main-process replay integration tests

## Summary
Add dedicated tests for the replay flow in `soniox-lifecycle.test.ts` and `session.test.ts`. The replay implementation (task 154, 155) was verified via the existing test suite (all 743 tests pass), but dedicated replay-flow tests would provide significantly better coverage of the new interaction patterns.

## Scope
Tests should cover:
- `beginReplayPhase` — entering replay mode and state transitions
- `endReplayPhase` — exiting replay mode and resuming normal operation
- `sendReplayAudio` — sending buffered audio for replay transcription
- Replay-aware `resumeSession` flow — full end-to-end resume with replay
- Live audio buffering during replay — audio captured while replay is in progress is buffered and sent after replay completes
- Drain detection heuristic — verifying that the drain-complete signal fires correctly
- Timeout fallback — ensuring the 10-second safety timeout triggers when drain detection doesn't
- Ghost conversion IPC timing — verifying the `convertCleanTailToGhost` IPC fires at the correct point in the replay flow
- `effectiveReplayStartMs` computation — verifying the timestamp offset calculation

## Notes
The existing mock infrastructure in `soniox-lifecycle.test.ts` doesn't expose the `sliceFromWithMeta` mock needed for replay tests. Adding replay tests requires extending the hoisted mock setup to include this mock.

## References
- Source: task 154 discovered tasks
- Related: task 154 (replay ghost regions), task 155/170 (audio replay buffering)
- Key files: `src/main/soniox-lifecycle.test.ts`, `src/main/session.test.ts`
