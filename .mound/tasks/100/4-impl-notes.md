# Implementation Notes

## Files modified

- `src/renderer/overlay/editor/TokenCommitPlugin.tsx` — Hoisted `cursorAtEnd` variable out of the `editor.update()` callback. Added scroll-to-bottom logic after the discrete update, gated by `cursorAtEnd` (cursor at document end) and `nearBottom` (viewport already within 50px of bottom).
- `src/renderer/overlay/editor/GhostTextPlugin.tsx` — Added scroll-to-bottom logic after ghost text (non-final tokens) are applied, gated by `nearBottom` only (ghost text doesn't affect cursor position).

## Deviations from plan

None.

## New tasks or follow-up work

None discovered.
