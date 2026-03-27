Trivial: yes

## Files modified

- `src/renderer/overlay/editor/replayGhostConversion.ts` — Extracted `paragraphs[i]` into a `const node` variable so `$isParagraphNode()` type guard narrows the type from `LexicalNode` to `ParagraphNode`, making `getChildrenSize()` and `getChildren()` calls valid.

## Deviations from plan

None.

## New tasks or follow-up work

None.
