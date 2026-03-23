# Implementation Notes

## Files Modified

- `src/renderer/overlay/editor/GhostTextPlugin.tsx` — Added overflow guard (`overflow > 0`) before scrolling in the `onTokensNonfinal` handler. The scroll now only triggers when content actually exceeds the visible area after ghost text is rendered.
- `src/renderer/overlay/editor/TokenCommitPlugin.tsx` — Applied the same overflow guard to the final-token scroll logic for consistency.

## Deviations from Plan

None.

## New Tasks / Follow-up Work

None discovered.
