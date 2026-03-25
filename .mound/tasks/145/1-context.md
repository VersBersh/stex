# Context

## Relevant Files

- `src/renderer/overlay/editor/TokenCommitPlugin.tsx` — The plugin that receives finalized Soniox tokens via `window.api.onTokensFinal` and appends them to the Lexical editor. Currently joins all token texts into a single `$createTextNode`. This is the main file that needs modification.
- `src/renderer/overlay/editor/Editor.tsx` — The Lexical editor setup component with `initialConfig`. Currently has no `nodes` array — only uses built-in nodes. Needs to register `TimestampedTextNode`.
- `src/shared/types.ts` — Defines `SonioxToken` with `text`, `start_ms`, `end_ms`, `confidence`, `is_final`, `speaker?` fields.
- `src/renderer/overlay/editor/cursorTracking.test.ts` — Integration tests for cursor tracking during token commits. Uses `createEditor`, `$createTextNode`, `$createParagraphNode`. Test helper `simulateTokenCommit` mirrors the append logic from `TokenCommitPlugin`.
- `src/renderer/overlay/editor/multiParagraphIntegration.test.ts` — Integration tests for paragraph split/join with block manager. Also uses `createEditor` and `$createTextNode`.
- `src/renderer/overlay/editor/lexicalTextContract.ts` — Utility for reading full document text from Lexical editor state.
- `src/renderer/overlay/editor/GhostTextPlugin.tsx` — Ghost text rendering; no direct changes needed but shares the cursor tracking pattern.
- `src/renderer/overlay/editor/InlineEditPlugin.tsx` — Detects user edits; operates on text diffs, not node types. No changes needed.
- `src/renderer/overlay/editor/UserTypingPlugin.tsx` — Tracks user typing via text comparison. No changes needed.
- `spec/proposal-context-refresh.md` — Parent feature proposal that motivates timestamped nodes for audio replay point determination.

## Architecture

The editor subsystem uses Lexical (v0.22.x) with a `LexicalComposer` setup in `Editor.tsx`. The editor currently uses only built-in Lexical nodes (ParagraphNode, TextNode).

**Token flow**: Soniox transcription produces `SonioxToken[]` objects (with `text`, `start_ms`, `end_ms`). These arrive via IPC through `window.api.onTokensFinal`. `TokenCommitPlugin` receives them, joins all token texts into a single string, and creates one `$createTextNode(text)` that gets appended to the last paragraph in the editor.

**Key behaviors preserved by the commit flow**:
1. **Historic tag** — Updates are tagged `'historic'` + `discrete: true` to bypass undo history
2. **Cursor tracking** — If cursor is at document end, it advances; if mid-document, it's preserved
3. **Scroll follow** — If viewport was near bottom, it scrolls to follow new text
4. **Undo/redo reset** — After each commit, undo/redo stacks are cleared

**Lexical custom node pattern** (standard for v0.22.x): Subclass `TextNode`, implement static `getType()` returning a unique string, static `clone()`, `createDOM()`, `updateDOM()`, `exportJSON()`, static `importJSON()`. Register in the `initialConfig.nodes` array using `{ replace: TextNode, with: ... }` syntax or direct inclusion. For this task, direct inclusion is appropriate since we want `TimestampedTextNode` to coexist with regular `TextNode` (not replace it).
