# Spec Updates — Task 152: Connection Handoff on Resume

## Spec changes required

No changes to `spec/proposal-context-refresh.md` are needed. The spec already fully describes:
- The connection handoff flow (steps 7–12 in "High-level flow")
- The `connectionBaseMs` rules for reconnect with and without replay
- The session layer's role in coordinating the renderer's replay analysis
- The `ReplayAnalysisResult` interface shape

The spec describes replay, ghost-text conversion, and buffered live audio — features outside this task's scope. This task implements the subset: close-old/open-new/set-connectionBaseMs/resume-capture. The spec does not need to be narrowed to match the task scope; it serves as the authoritative reference for the full feature.

## New spec content

None required. The `ReplayAnalysisResult` type is already defined in `spec/proposal-context-refresh.md` and implemented in `src/renderer/overlay/editor/analyzeReplayEligibility.ts` (task 151). This task moves the type to `src/shared/types.ts` for cross-process sharing — a code change, not a spec change.
