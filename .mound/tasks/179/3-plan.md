# Plan

## Goal

Fix TypeScript compilation errors in `replayGhostConversion.ts` by extracting the array-indexed access into a local variable so `$isParagraphNode` type narrowing works.

## Steps

1. **Edit `src/renderer/overlay/editor/replayGhostConversion.ts`**
   - In the `for` loop (lines 28-33), extract `paragraphs[i]` into a `const node` variable before the `if` check.
   - Use `node` in the `$isParagraphNode()` guard and `getChildrenSize()` call, and assign `node` to `targetParagraph`.
   - This allows TypeScript to narrow `node` from `LexicalNode` to `ParagraphNode` after the type guard, making `getChildrenSize()` (line 29) and `getChildren()` (line 37 via `targetParagraph`) valid.

## Risks / Open Questions

None — this is a mechanical type-narrowing fix with no behavioral change.
