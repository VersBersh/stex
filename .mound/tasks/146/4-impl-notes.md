# Implementation Notes — Task 146

Trivial: no

## Files created or modified

| File | Change |
|------|--------|
| `src/renderer/overlay/editor/verboseEditorLog.ts` (new) | Utility with `isVerboseEditorLog()` (localStorage gate) and `verboseLog()` (console.debug formatter) |
| `src/renderer/overlay/editor/DirtyLeavesLogPlugin.tsx` (new) | Lexical plugin that logs dirty leaves on each non-historic update with prev/curr state comparison |
| `src/renderer/overlay/editor/TokenCommitPlugin.tsx` (modified) | Added before/after child-count logging around token commit to log newly created nodes |
| `src/renderer/overlay/editor/Editor.tsx` (modified) | Registered `DirtyLeavesLogPlugin` after `GhostTextPlugin` |

## Deviations from plan

1. **Used proper type guards instead of `as any` casts**: Since Task 145 has already merged, used `$isTimestampedTextNode()` type guard and `getStartMs()`/`getEndMs()`/`getOriginalText()` getters instead of the `(node as any).__startMs` pattern the plan suggested. This is safer and more maintainable.

2. **`verboseLog` does not re-check the flag**: The plan showed `verboseLog` checking `isVerboseEditorLog()` internally. Instead, `verboseLog` is a pure formatting function (`console.debug` wrapper), and callers gate with a single `isVerboseEditorLog()` check at the top of each callback. This addresses the design review's concern about redundant `localStorage` reads per keystroke.

3. **Token commit logging reads flag once into `const verbose`**: The `isVerboseEditorLog()` is read once before the `editor.update()` call and reused for the post-update logging block, avoiding double localStorage access.

4. **Added comment documenting REMOVED action assumption**: The design review flagged that `REMOVED` detection depends on Lexical including deleted node keys in `dirtyLeaves`. Added a comment explaining this assumption and noting that the absence of `REMOVED` is itself diagnostic data.

## New tasks or follow-up work

None discovered.
