# Implementation Notes

## Files created or modified

| File | Changes |
|------|---------|
| `src/renderer/overlay/editor/TokenCommitPlugin.tsx` | Added 300ms flush timeout that fires after last final-token batch, flushing the pending buffer so the last word appears. Timer is cleared on session pause/stop, replay, editor clear, and unmount. |
| `src/renderer/overlay/editor/tokenMerger.test.ts` | Added test case documenting the full utterance → buffer → flush scenario. |
| `spec/features/realtime-transcription.md` | Updated silence edge case to describe the timeout-based flush. |

## Deviations from plan

None. Implementation follows the plan exactly.

## Design review notes

The design review flagged the timer approach as a temporal coupling (Major) and the growing file size as an SRP concern (Minor). Both were considered during planning:

- **Timer vs. endpoint signal**: The timer was deliberately chosen over an explicit `<end>`-based signal because it's self-contained in the renderer (no cross-process IPC changes needed) and doesn't depend on Soniox's exact endpoint marker timing. The 300ms threshold is well above the typical inter-batch gap (~100-200ms), making the split-word risk negligible. See plan Risks #1.
- **File size (316 lines)**: Valid concern but extracting timer management into a separate hook is refactoring, not a bug fix. Noted as follow-up.

## New tasks or follow-up work

1. **Consider replacing timer with explicit endpoint signal**: Surface Soniox `<end>` markers as a renderer event to provide a protocol-based flush trigger instead of a timeout heuristic. Lower priority — the timer approach works correctly for all practical scenarios.
2. **Refactor TokenCommitPlugin**: Extract pending-buffer/timer orchestration into a focused hook to reduce file size and improve SRP.
