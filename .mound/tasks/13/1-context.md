# Context — T13: Token Commit & EditorBlock Management

## Relevant Files

| File | Role |
|------|------|
| `src/shared/types.ts` | Defines `EditorBlock`, `SonioxToken`, `GhostText`, `SessionState` interfaces |
| `src/shared/ipc.ts` | Defines `IpcChannels` including `TOKENS_FINAL` and `TOKENS_NONFINAL` |
| `src/shared/preload.d.ts` | Declares `ElectronAPI` interface with `onTokensFinal`, `onTokensNonfinal` methods; augments `window.api` |
| `src/renderer/types.d.ts` | Declares `window.electronAPI` (hide, pause, resume, theme) |
| `src/preload/index.ts` | Preload bridge exposing `window.api` — already wires `onTokensFinal` and `onTokensNonfinal` IPC listeners |
| `src/main/session.ts` | Session manager — sends `TOKENS_FINAL` / `TOKENS_NONFINAL` IPC from main process to renderer |
| `src/renderer/overlay/editor/Editor.tsx` | Lexical editor component with `LexicalComposer`, `HistoryPlugin`, `EditorBridge` |
| `src/renderer/overlay/OverlayContext.tsx` | React context providing editor ref via `registerEditor`, plus clear/pause/copy actions |
| `src/renderer/overlay/index.tsx` | Root overlay app — `OverlayProvider` wrapping `Editor` + `StatusBar` |
| `src/renderer/overlay/components/StatusBar.tsx` | Status bar UI with pause/clear/copy buttons |
| `src/main/preload.ts` | Preload for `window.electronAPI` (hideWindow, pause, resume, theme) |
| `spec/models.md` | Spec for `EditorBlock` ownership rules, block boundaries, undo/redo scope |
| `spec/api.md` | Spec for client-side token processing flow |
| `spec/features/realtime-transcription.md` | Spec for token commit flow end-to-end |
| `vitest.config.ts` | Test config — includes `src/**/*.test.ts` |
| `src/main/session.test.ts` | Example test file showing hoisted mock pattern with vitest |

## Architecture

### Subsystem: Overlay Renderer (Token Commit)

The overlay renderer is a React app running in an Electron `BrowserWindow`. It contains a Lexical editor and receives token events from the main process via IPC.

**Current flow:**
1. Main process `session.ts` creates a `SonioxClient` and receives `onFinalTokens` / `onNonFinalTokens` callbacks
2. These callbacks send IPC messages (`tokens:final`, `tokens:nonfinal`) to the renderer via `webContents.send`
3. Preload bridge (`src/preload/index.ts`) exposes `window.api.onTokensFinal()` and `window.api.onTokensNonfinal()`
4. **Currently nothing in the renderer listens to these events** — this is the gap this task fills

**Lexical editor setup:**
- Standard `LexicalComposer` with `RichTextPlugin`, `HistoryPlugin`, `AutoFocusPlugin`
- `EditorBridge` component registers the Lexical editor instance in `OverlayContext` via `registerEditor`
- The editor ref is stored in `editorRef` in `OverlayContext` and used for `clearEditor`, `isEditorEmpty`, and `copyText`
- No custom Lexical node types — spec explicitly says to avoid this

**Key constraints:**
- `EditorBlock[]` is a **separate data structure** alongside Lexical — not 1:1 with Lexical nodes
- Block boundaries are tracked by character offset ranges within the document
- Programmatic appends must bypass Lexical's undo history (`HistoryPlugin`)
- Two `window` APIs coexist: `window.api` (preload/index.ts) and `window.electronAPI` (main/preload.ts)
