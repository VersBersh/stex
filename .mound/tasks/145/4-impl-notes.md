# Implementation Notes

## Files created or modified

- `src/renderer/overlay/editor/TimestampedTextNode.ts` (new) — Custom Lexical `TextNode` subclass with `startMs`, `endMs`, `originalText` fields
- `src/renderer/overlay/editor/TimestampedTextNode.test.ts` (new) — Unit tests for the custom node
- `src/renderer/overlay/editor/Editor.tsx` (modified) — Added `TimestampedTextNode` to `initialConfig.nodes`
- `src/renderer/overlay/editor/TokenCommitPlugin.tsx` (modified) — Replaced single `$createTextNode(text)` with per-token `$createTimestampedTextNode` loop
- `spec/models.md` (modified) — Updated "Mapping to Lexical" section to reflect custom node usage

## Deviations from plan

- In `TokenCommitPlugin.tsx`, refactored the if/else paragraph selection into a single `targetParagraph` variable using an IIFE, then a single `for` loop — cleaner than duplicating the loop in both branches.
- Added empty-token skip (`token.text.length === 0`) in the append loop per code review feedback.
- Made `originalText` parameter default to `text` in `$createTimestampedTextNode` factory per code review feedback, reducing call-site duplication.
- Fixed tests to assert via `exportJSON()` instead of internal `__` fields per code review feedback.

## New tasks or follow-up work

None discovered.
