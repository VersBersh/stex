# Context

## Relevant Files

- `src/renderer/overlay/editor/TokenCommitPlugin.tsx` — Receives final transcription tokens via IPC and appends them to the Lexical editor. Contains cursor-at-end detection logic that determines whether the caret should advance with transcription or stay in place. **This is the file to fix.**
- `src/renderer/overlay/editor/Editor.tsx` — Composes the Lexical editor with all plugins (TokenCommitPlugin, GhostTextPlugin, InlineEditPlugin, etc.)
- `src/renderer/overlay/overlay.css` — Styles for the overlay app including `.editor-container` (has `overflow-y: auto`) and `.editor-input`
- `src/renderer/overlay/editor/GhostTextPlugin.tsx` — Displays non-final (interim) tokens as ghost text via CSS `::after` pseudo-element
- `src/renderer/overlay/editor/editorBlockManager.ts` — Tracks which text came from speech vs. user typing
- `src/renderer/overlay/editor/InlineEditPlugin.tsx` — Detects user edits in the editor and updates block manager
- `src/renderer/overlay/OverlayContext.tsx` — Overlay-level context providing clearEditor, registerEditor, etc.

## Architecture

The editor is a **Lexical** (Meta's headless editor framework) instance rendered inside an Electron overlay window. The transcription pipeline:

1. **Soniox WebSocket** (main process) receives speech tokens → IPC → renderer
2. **TokenCommitPlugin** listens for `tokens:final` events, appends text to the Lexical document
3. **GhostTextPlugin** shows interim (non-final) tokens as faded CSS pseudo-element text

**Cursor management in TokenCommitPlugin** (lines 64-119):
- Before appending, it checks if the cursor is a collapsed caret at the document's end (`cursorAtEnd`)
- If `cursorAtEnd` is true: cursor naturally advances with the new text (Lexical default)
- If `cursorAtEnd` is false: cursor position is saved and restored after the append, so user edits aren't disrupted

**Scrolling**: The `.editor-container` div has `overflow-y: auto`. There is **no explicit scroll-to-caret logic** after programmatic text appends. The browser's automatic caret-following works for user keystrokes but does NOT work for programmatic Lexical updates via `editor.update()`.

**Key constraint**: The `editor.update()` call uses `discrete: true` (synchronous), so the DOM is updated by the time the call returns. Scrolling can happen immediately after.
