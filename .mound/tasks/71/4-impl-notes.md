# Implementation Notes

## Files modified

- `src/renderer/overlay/editor/InlineEditPlugin.tsx` — Removed Enter key intercept (`KEY_ENTER_COMMAND` handler) and unused imports. Added idempotency guard: skips `applyEdit` if `blockManager.getDocumentText()` already matches the current editor text (fixes temporal coupling with `UserTypingPlugin`).
- `src/renderer/overlay/editor/InlineEditPlugin.test.ts` — Added 6 multi-paragraph tests for `findTextDiff` with `\n\n` separators.
- `src/renderer/overlay/editor/editorBlockManager.test.ts` — Added 8 multi-paragraph tests covering mid-doc split, tail break, typing after break, paragraph join, token commit after break, getBaseText with `\n\n`, combined applyEdit/replaceLastUserBlock convergence (both orders).
- `spec/models.md` — Added paragraph to "Mapping to Lexical" documenting `\n\n` representation of paragraph boundaries in block text.

## Deviations from plan

- Task description stated `\n` separator but verified Lexical uses `\n\n` (`DOUBLE_LINE_BREAK`). All test expectations use `\n\n`. This was anticipated in the revised plan.
- No changes to `editorBlockManager.ts` — the block manager already handles `\n\n` as regular text characters. This was expected.
- Added idempotency guard in `InlineEditPlugin` (not in original plan) — discovered during design review. The guard `blockManager.getDocumentText() === currentText` prevents double-application of edits when `UserTypingPlugin` runs before `InlineEditPlugin`.

## Test verification

All 69 tests pass (68 original + 1 new reverse-order test):
- `editorBlockManager.test.ts`: 55 tests passing
- `InlineEditPlugin.test.ts`: 14 tests passing (after adding the `\n\n` test section)

## New tasks or follow-up work

- **EDITOR: Integration tests for multi-paragraph editing with Lexical**: Full integration test with Lexical editor + InlineEditPlugin + UserTypingPlugin running together, verifying paragraph splits, joins, and token commits maintain offset consistency. Requires JSDOM/Lexical test setup.
- **EDITOR: Centralize Lexical text serialization contract**: Both InlineEditPlugin and UserTypingPlugin depend on Lexical's `$getRoot().getTextContent()` separator behavior. Consider extracting a shared helper that codifies the contract, so a Lexical upgrade that changes the separator would be caught at one point rather than silently desyncing.
