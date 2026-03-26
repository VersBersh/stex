# Implementation Notes

## Files created or modified

- `src/renderer/overlay/editor/analyzeReplayEligibility.ts` (new) — Pure analysis function `$analyzeReplayEligibility()` and `ReplayAnalysisResult` type. Walks editor leaf nodes, classifies them, applies three guards, determines replay timestamps.
- `src/renderer/overlay/editor/analyzeReplayEligibility.test.ts` (new) — 12 unit tests covering all guards, suffix-match logic, edge cases (empty editor, no clean tail, multiple dirty nodes, proximity boundary).

## Deviations from the plan

None. Implementation follows the plan exactly.

## New tasks or follow-up work

- The function is currently a pure analysis module. A future task will need to wire it into the resume flow — either as a plugin that listens for `onSessionResumed` or as a function called by the OverlayContext/pauseController at resume time, sending the result via IPC to the main process.
- The `ReplayAnalysisResult` type may need to be added to the shared IPC types (`src/shared/types.ts`) or the preload API (`src/shared/preload.d.ts`) when the resume-flow integration task is implemented.
