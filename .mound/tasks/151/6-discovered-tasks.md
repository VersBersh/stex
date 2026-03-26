# Discovered Tasks

1. **ORCH: Wire replay analysis into resume flow**
   - Description: Integrate `$analyzeReplayEligibility()` into the pause-resume flow. At resume time, the renderer should call the analysis function inside `editorState.read()`, then send the `ReplayAnalysisResult` to the main process via IPC so it can combine with `pendingStartMs` to determine the effective replay start.
   - Why: The analysis function exists as a standalone module but nothing calls it yet. The resume flow in `session.ts` / `OverlayContext.tsx` needs to invoke it and communicate the result.

2. **ORCH: Add `ReplayAnalysisResult` to shared IPC types**
   - Description: Add the `ReplayAnalysisResult` interface to `src/shared/types.ts` (or a new shared file) and add a corresponding IPC channel/method to `src/shared/preload.d.ts` for sending the analysis result from renderer to main.
   - Why: The type is currently defined only in the renderer module. For IPC communication, it needs to be in the shared types.
