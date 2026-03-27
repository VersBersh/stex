# Fix TS2339 type errors in replayGhostConversion.ts

## Summary

`src/renderer/overlay/editor/replayGhostConversion.ts` has two TypeScript compilation errors that cause `tsc --noEmit -p tsconfig.renderer.json` to fail:

```
src/renderer/overlay/editor/replayGhostConversion.ts(29,58): error TS2339: Property 'getChildrenSize' does not exist on type 'LexicalNode'.
src/renderer/overlay/editor/replayGhostConversion.ts(37,36): error TS2339: Property 'getChildren' does not exist on type 'LexicalNode'.
```

`root.getChildren()` returns `LexicalNode[]`, but `getChildrenSize()` (line 29) and `getChildren()` (line 37) are methods on `ElementNode`, not `LexicalNode`. The code correctly guards with `$isParagraphNode(paragraphs[i])` but TypeScript does not narrow the type because the check uses array indexing (`paragraphs[i]`) rather than a local variable.

These errors are caught by the typecheck test in `src/typecheck.test.ts` which runs `tsc --noEmit -p tsconfig.renderer.json`.

## Acceptance criteria

- `npx tsc --noEmit -p tsconfig.renderer.json` passes with zero errors.
- The typecheck vitest test (`src/typecheck.test.ts`, "renderer and shared sources pass tsc") passes.
- No change to runtime behavior of `$convertToReplayGhost`.

## Suggested fix

In the for-loop at line 28–32, extract the array element to a local variable and apply the `$isParagraphNode` guard to it, so TypeScript narrows the type to `ParagraphNode` (which extends `ElementNode`):

```ts
for (let i = paragraphs.length - 1; i >= 0; i--) {
  const para = paragraphs[i];
  if ($isParagraphNode(para) && para.getChildrenSize() > 0) {
    targetParagraph = para;
    break;
  }
}
```

This also fixes line 37 since `targetParagraph` would then be typed as `ParagraphNode | null`.

## References

- `src/renderer/overlay/editor/replayGhostConversion.ts` (lines 28–37)
- `src/typecheck.test.ts` (typecheck test)
- `tsconfig.renderer.json`
