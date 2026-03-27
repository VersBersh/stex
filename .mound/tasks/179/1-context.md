# Context

## Relevant Files

- `src/renderer/overlay/editor/replayGhostConversion.ts` — Contains the `$convertToReplayGhost` function with the TS errors. Calls `getChildrenSize()` and `getChildren()` on `LexicalNode` instead of `ElementNode`/`ParagraphNode`.

## Architecture

The overlay renderer uses Lexical as a rich text editor. `replayGhostConversion.ts` exports a function that walks the editor tree to extract "ghost text" for replay. It's called from `TokenCommitPlugin.tsx` → `Editor.tsx` → `index.tsx`.

The bug: `root.getChildren()` returns `LexicalNode[]`. The code uses `$isParagraphNode()` as a type guard, but accesses the element via `paragraphs[i]` (array index) — TypeScript doesn't narrow array-indexed access, so `paragraphs[i]` stays typed as `LexicalNode` even after the guard. `getChildrenSize()` and `getChildren()` exist on `ElementNode` (parent of `ParagraphNode`), not `LexicalNode`.
