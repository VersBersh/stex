# Plan

## Goal

Enable multi-paragraph editing by removing the Enter key intercept and verifying that paragraph separator characters from Lexical flow naturally through the existing block manager offset model.

## Key Finding: Lexical Uses `\n\n` Between Paragraphs

Verified in `node_modules/lexical/Lexical.dev.js`:
- `ElementNode.getTextContent()` (line 9058) adds `DOUBLE_LINE_BREAK = '\n\n'` between non-inline element children
- `RootNode.getTextContent()` (line 9500) delegates to `super.getTextContent()` (ElementNode)
- ParagraphNode does not override `getTextContent()`

So `$getRoot().getTextContent()` with paragraphs `["Hello", "world"]` returns `"Hello\n\nworld"`.

The task description says `\n` — it is actually `\n\n`. The approach is identical; only test expectations differ.

## Steps

### 1. Remove Enter key intercept from `InlineEditPlugin`

**File**: `src/renderer/overlay/editor/InlineEditPlugin.tsx`

- Remove the `useEffect` block (lines 15–21) that registers `KEY_ENTER_COMMAND` to suppress paragraph splits.
- Remove `KEY_ENTER_COMMAND` and `COMMAND_PRIORITY_HIGH` from the `lexical` import (line 3) since they are no longer used.
- Keep the `$getRoot` import (still used by the update listener).

**Dependencies**: None.

### 2. Add multi-paragraph tests to `InlineEditPlugin.test.ts`

**File**: `src/renderer/overlay/editor/InlineEditPlugin.test.ts`

Add test cases for `findTextDiff` with `\n\n` (paragraph separator):

- **Paragraph split**: `findTextDiff("Hello world", "Hello\n\n world")` → `{ offset: 5, removedLength: 0, insertedText: "\n\n" }`
- **Paragraph join**: `findTextDiff("Hello\n\n world", "Hello world")` → `{ offset: 5, removedLength: 2, insertedText: "" }`
- **Text insertion in second paragraph**: `findTextDiff("Hello\n\n", "Hello\n\nworld")` → `{ offset: 7, removedLength: 0, insertedText: "world" }`
- **Replacement across paragraph boundary**: `findTextDiff("Hello\n\nworld", "Hello earth")` → `{ offset: 5, removedLength: 7, insertedText: " earth" }`

**Dependencies**: None.

### 3. Add multi-paragraph tests to `editorBlockManager.test.ts`

**File**: `src/renderer/overlay/editor/editorBlockManager.test.ts`

Add a new `describe('multi-paragraph support')` section with these tests:

- **Mid-document paragraph split**: Commit tokens "Hello world", apply `applyEdit(5, 0, "\n\n")`. Verify:
  - Block text = "Hello\n\n world", modified = true
  - `getDocumentText()` = "Hello\n\n world"
  - `getDocumentLength()` = 13

- **Tail paragraph break (Enter at end)**: Commit tokens "Hello world", apply `applyEdit(11, 0, "\n\n")`. Verify:
  - Creates user block with text "\n\n"
  - `getDocumentText()` = "Hello world\n\n"
  - `getDocumentLength()` = 13

- **Typing after paragraph break**: After tail "\n\n" insertion above, apply `applyEdit(13, 0, "more")`. Verify user block extends to "\n\nmore". `getDocumentText()` = "Hello world\n\nmore".

- **Paragraph join (delete \n\n)**: Set up block with "Hello\n\n world" (via commitFinalTokens + applyEdit), then apply `applyEdit(5, 2, "")`. Verify text = "Hello world".

- **Token commit after paragraph break**: Commit "Hello world", insert "\n\n" at offset 5 (marks soniox modified). Commit new tokens " today". Verify new soniox block created (since previous is modified). `getDocumentText()` = "Hello\n\n world today".

- **getBaseText with \n\n in blocks**: Commit tokens, insert "\n\n" mid-document (marks modified), then tail-insert user text. Verify `getBaseText()` excludes trailing user block but includes the modified soniox block with "\n\n".

- **Combined applyEdit + replaceLastUserBlock consistency**: Simulates both plugins firing:
  1. Commit tokens "Hello world"
  2. applyEdit(11, 0, "\n\n") → creates user block "\n\n"
  3. replaceLastUserBlock("\n\n") → user block stays "\n\n" (idempotent)
  4. applyEdit(13, 0, "more") → extends user block to "\n\nmore"
  5. replaceLastUserBlock("\n\nmore") → user block stays "\n\nmore"
  6. Verify final state matches throughout

**Dependencies**: None.

### 4. Update `spec/models.md`

**File**: `spec/models.md`

Append to the "Mapping to Lexical" subsection (after the existing paragraph ending at line 59, before "### Undo/Redo Scope"):

```
Paragraph boundaries in Lexical (multiple `ParagraphNode` children of the root) are represented as newline characters within block text, matching the separator returned by Lexical's `$getRoot().getTextContent()` (currently `\n\n`). When a user splits or joins paragraphs, these characters are inserted or removed via the standard `applyEdit` mechanism — no special handling is needed. The block manager's offset model (character-level) naturally accounts for them as regular characters.
```

**Dependencies**: None.

### 5. Run tests and verify

Run `vitest` for the editor test files to verify:
- All existing tests still pass (no regression in single-paragraph behavior)
- New multi-paragraph tests pass
- `findTextDiff` handles `\n\n` correctly

**Dependencies**: Steps 1–4.

## Risks / Open Questions

1. **No block manager code changes needed**: The block manager already treats text as opaque character sequences. `\n\n` is just two characters. This means the implementation is minimal — removing the intercept, adding tests, and updating the spec. If reviewers expect explicit paragraph separator modeling (e.g., a `paragraphBreakAfter` flag on blocks), that would be a different design but is unnecessary given the current architecture.

2. **Integration test gap**: Full integration testing (Lexical editor + both plugins + block manager together) would require JSDOM/Lexical test setup, which is beyond this task's scope. The combined `applyEdit` + `replaceLastUserBlock` consistency test in Step 3 simulates the dual-plugin scenario at the block manager level. A discovered task should be created for end-to-end integration tests.

3. **UserTypingPlugin consistency**: When `\n\n` is embedded in block text, `getBaseText()` includes it. `UserTypingPlugin` checks `fullText.startsWith(baseText)` — this works because Lexical's `getTextContent()` also includes the `\n\n`. Verified via manual tracing of multiple scenarios (Enter at end, Enter in middle, typing after Enter, token commit after Enter).
