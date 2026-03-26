# Discovered Tasks — Task 154

## 1. SONIOX: Add main-process replay integration tests
- **Description**: Add dedicated tests for `beginReplayPhase`, `endReplayPhase`, `sendReplayAudio`, and the replay-aware `resumeSession` flow in `soniox-lifecycle.test.ts` and `session.test.ts`. Tests should cover: live audio buffering during replay, drain detection heuristic, timeout fallback, ghost conversion IPC timing, effectiveReplayStartMs computation.
- **Why discovered**: The existing mock infrastructure in `soniox-lifecycle.test.ts` doesn't expose the `sliceFromWithMeta` mock needed for replay tests. Adding it requires extending the hoisted mock setup. The implementation was verified via the existing test suite (all 743 tests pass) but dedicated replay-flow tests would provide better coverage of the new interaction patterns.

## 2. SONIOX: Handle zero-token replay drain edge case
- **Description**: When replay audio contains only silence, Soniox may produce no final tokens at all. The current drain detection heuristic never triggers, and the 10-second safety timeout is the only completion mechanism. Consider adding a shorter timeout (e.g., 3 seconds) specifically for the case where zero tokens have been received after replay audio is sent.
- **Why discovered**: Identified during implementation of the drain detection logic in `sendReplayAudio`. The 10-second timeout works but delays normal operation unnecessarily for the silence-only case.
