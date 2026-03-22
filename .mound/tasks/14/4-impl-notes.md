# T14: Implementation Notes

## Files created or modified

### Modified
- `src/renderer/overlay/editor/editorBlockManager.ts` — Added `getDocumentLength()`, `applyEdit()`, and internal `getBlockOffsets()`. Changed from direct return object to `const manager = { ... }; return manager;` pattern so `applyEdit` can self-reference for the tail-fallback case. Added empty-block pruning after edits.
- `src/renderer/overlay/editor/TokenCommitPlugin.tsx` — Added cursor preservation: before appending text, checks if cursor is a collapsed caret at end of committed text. Handles both text-node-end and paragraph-end caret positions. Non-collapsed selections are always restored. Added imports for `$getSelection`, `$isRangeSelection`, `$isTextNode`, `$setSelection`.
- `src/renderer/overlay/editor/Editor.tsx` — Imported and registered `InlineEditPlugin` after `TokenCommitPlugin`.
- `src/renderer/overlay/editor/editorBlockManager.test.ts` — Added test suites for `getDocumentLength`, `applyEdit` (tail, mid, cross-block), and `commitFinalTokens` after modification. Cross-block deletion test asserts empty blocks are pruned.
- `spec/features/inline-editing.md` — Added "Cursor Tracking Behavior" subsection and "Selection Preservation" subsection.
- `spec/models.md` — Fixed rules 3 and 4 to match actual merge behavior; added rule 5 for mid-document edit detection.

### Created
- `src/renderer/overlay/editor/InlineEditPlugin.tsx` — New Lexical plugin that listens for user-initiated text changes via `registerUpdateListener`, computes minimal text diff, and routes through `blockManager.applyEdit()`. Skips `'historic'`-tagged updates. Also intercepts `KEY_ENTER_COMMAND` to enforce single-paragraph editing (prevents offset drift between Lexical text content and block manager).
- `src/renderer/overlay/editor/InlineEditPlugin.test.ts` — Unit tests for `findTextDiff` pure function.

## Deviations from plan

- Added `KEY_ENTER_COMMAND` interception in `InlineEditPlugin` to enforce single-paragraph editing. This was not in the plan but was identified as a Major issue during code review — the block manager's offset model assumes no paragraph separators, yet nothing prevented Enter from creating new paragraphs.
- Added empty-block pruning in `applyEdit()` — the plan's cross-block handling left zero-length blocks in the array.
- Cursor-at-end detection was refined beyond the plan to require `isCollapsed()` and handle paragraph-end caret positions.

## New tasks or follow-up work

- **EDITOR: Undo/redo integration with modified blocks** — The `modified` flag is not part of Lexical's undo system. If a user edits a block then undoes, the block stays `modified: true`. This is safe (conservative) but could be refined. Noted in plan risks section.
- **EDITOR: Multi-paragraph support for block manager** — Currently enforced as single-paragraph. If multi-paragraph support is needed in the future, the block manager's text representation must account for paragraph newlines.
