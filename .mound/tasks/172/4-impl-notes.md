# Implementation Notes

## Files modified

- `src/main/soniox-lifecycle.test.ts` — Added `endReplayPhase` to import, added 9 new replay tests in `describe('replay — state transitions and audio buffering')` covering: state transitions, audio buffering during replay, buffer flush/discard on endReplayPhase, null/empty slice handling, connectionBaseMs update from actualStartMs, disconnect/error during replay.
- `src/main/session.test.ts` — Added `isInReplayPhase` to import from soniox-lifecycle, added 3 new replay flow tests in `describe('replay flow')` covering: ghost conversion IPC + replay audio send + call ordering, effectiveReplayStartMs computation with pendingStartMs, fresh reconnect for ineligible replay. Also fixed the existing `prevents re-entrant resume` test to respond to its pending analysis (preventing dangling async state).

## Deviations from plan

- Consolidated the first three planned session.test.ts tests (ghost IPC, replay audio, ordering) into one comprehensive test. This avoids inter-test contamination from dangling async operations (RESUME_ANALYSIS_TIMEOUT_MS).
- Added a `beforeEach` to the `replay flow` describe that waits 1200ms for dangling timeouts from previous tests to settle, then re-initializes session state. This is needed because earlier tests in the same file can leave unresolved `resumeSession()` async operations with real 1000ms timeouts that corrupt module state when they fire.
- Fixed the existing `prevents re-entrant resume` test to call `respondToResumeAnalysis()` at the end, preventing it from leaving a dangling `getResumeAnalysis()` timeout.
- Removed unused `CHUNK_DURATION_MS` constant.

## Follow-up work

None discovered.
