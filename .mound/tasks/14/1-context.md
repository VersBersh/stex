# T14: Context — Inline Editing

## Relevant Files

### Core Editor (files that need modification)
- `src/renderer/overlay/editor/TokenCommitPlugin.tsx` — Lexical plugin that listens for `tokens:final` IPC events, calls `blockManager.commitFinalTokens()`, then appends text to the Lexical editor. Currently moves cursor to end on every append. **Primary target for cursor preservation logic.**
- `src/renderer/overlay/editor/editorBlockManager.ts` — Factory creating a block manager that tracks `EditorBlock[]`. Has `commitFinalTokens()`, `getBlocks()`, `clear()`, `getDocumentText()`. **Needs new methods: `markBlockModified()` and `findBlockAtOffset()`** to support edit protection.
- `src/renderer/overlay/editor/Editor.tsx` — Main Lexical editor component. Composes `LexicalComposer` with plugins: `RichTextPlugin`, `HistoryPlugin`, `AutoFocusPlugin`, `TokenCommitPlugin`, `GhostTextPlugin`. **May need a new `CursorTrackingPlugin` or `InlineEditPlugin`.**
- `src/renderer/overlay/editor/GhostTextPlugin.tsx` — Renders non-final tokens as a CSS `::after` pseudo-element on the last paragraph. Uses `--ghost-text-content` CSS custom property.

### Data Model
- `src/shared/types.ts` — Defines `EditorBlock { id, text, source, modified }`, `SonioxToken`, `GhostText`, `SessionState`. The `modified` field already exists on `EditorBlock` but is never set to `true` in current code.

### Context / State
- `src/renderer/overlay/OverlayContext.tsx` — React context providing `registerEditor`, `registerClearHook`, `copyText`, `requestClear`, `togglePauseResume`. Holds `editorRef` for the Lexical editor instance. `copyText()` reads from `$getRoot().getTextContent()` — already works for select-all/copy scenarios.
- `src/renderer/overlay/pauseController.ts` — Manages pause/resume state via IPC events. Exposes `isPaused()`, `toggle()`, `subscribe()`.

### IPC & Pipeline
- `src/shared/ipc.ts` — IPC channel constants (`TOKENS_FINAL`, `TOKENS_NONFINAL`, `SESSION_STATUS`, etc.)
- `src/preload/index.ts` — Preload bridge exposing `window.api.onTokensFinal()`, `onTokensNonfinal()`, etc.
- `src/main/session.ts` — Session lifecycle: start/stop/pause/resume. Forwards final/non-final tokens from Soniox to renderer via IPC.
- `src/main/soniox.ts` — WebSocket client for Soniox STT API. Emits `onFinalTokens` and `onNonFinalTokens`.

### Styling
- `src/renderer/overlay/overlay.css` — Ghost text rendered via `.editor-input p:last-child::after` with `user-select: none; pointer-events: none`.

### Tests
- `src/renderer/overlay/editor/editorBlockManager.test.ts` — Tests for block manager: merging consecutive soniox batches, clear, independent instances.

### Specs
- `spec/features/inline-editing.md` — Full inline editing specification (cursor behavior, edit protection, append anchor rule, ghost text interaction, pause-edit-resume).
- `spec/features/inline-typing.md` — Inline typing during dictation (block boundary rules, typing at document tail creates user blocks).
- `spec/models.md` — EditorBlock ownership rules, block boundaries, Lexical mapping, undo/redo scope.

## Architecture

### Subsystem Overview

The editor subsystem is a Lexical-based text editor in the Electron renderer process. It receives transcription tokens from the main process via IPC and renders them as committed text (final tokens) or ghost text (non-final tokens).

### Token Flow

```
Main: Soniox WebSocket → session.ts → IPC (tokens:final / tokens:nonfinal)
         ↓
Renderer: preload bridge → window.api.onTokensFinal() / onTokensNonfinal()
         ↓
TokenCommitPlugin: blockManager.commitFinalTokens(tokens) → editor.update() append text
GhostTextPlugin: set CSS --ghost-text-content on root element
```

### Key Components

1. **EditorBlockManager** — In-memory array of `EditorBlock` objects. Tracks text ownership (`source: "soniox" | "user"`) and modification status (`modified: boolean`). Currently only supports `commitFinalTokens()` which appends/extends the last soniox block. The `modified` flag exists in the type but is never set to `true`.

2. **TokenCommitPlugin** — On each `tokens:final` event:
   - Calls `blockManager.commitFinalTokens(tokens)` to update block metadata
   - Calls `editor.update()` with `{ discrete: true, tag: 'historic' }` to append a `TextNode` to the last paragraph
   - Clears undo/redo stacks and sets `historyState.current` to post-append state
   - The `'historic'` tag prevents Lexical's HistoryPlugin from recording this update

3. **GhostTextPlugin** — Renders non-final tokens as a CSS pseudo-element (`::after`), making them visually present but not part of the DOM text content. Ghost text is `user-select: none; pointer-events: none`.

4. **Lexical Editor** — Uses standard `ParagraphNode` and `TextNode` types. No custom node types. Block boundaries are tracked by the EditorBlockManager as a separate data structure (character offset ranges), not as Lexical nodes.

### Key Constraints

- **Block boundaries are tracked by offset, not by Lexical node identity.** The block manager stores `text` on each block, and the total concatenation matches the Lexical document text. When the user edits text in the middle, the block manager must figure out which block was affected by comparing character positions.
- **Undo/redo scope:** Only user edits are undoable. Programmatic appends use the `'historic'` tag to bypass HistoryPlugin. Undo stacks are cleared after each append.
- **Ghost text is CSS-only:** It's a `::after` pseudo-element, not a Lexical node. It doesn't participate in selection or text content. This means `Ctrl+A` / `Ctrl+C` already excludes ghost text naturally.
- **No existing cursor management:** The current code doesn't do any explicit cursor positioning. Lexical naturally moves the cursor to the end of appended text. This is what needs to change for inline editing — the cursor must stay in place when the user is editing mid-document.
