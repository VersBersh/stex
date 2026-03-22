# Context — T16: Text Output & Finalization Flow

## Relevant Files

| File | Role |
|------|------|
| `src/main/session.ts` | Session Manager — orchestrates start/stop/pause/resume, finalization flow, clipboard text request. Contains `requestToggle()`, `stopSession()`, `waitForFinalization()`, `waitForClipboardText()`. |
| `src/main/window.ts` | Window Manager — show/hide overlay, position persistence. `WINDOW_HIDE` IPC handler routes through `requestOverlayDismiss()` → session close handler. |
| `src/main/tray.ts` | System tray icon & context menu. No flash mechanism currently. |
| `src/main/hotkey.ts` | Global hotkey registration. Calls `requestToggle()` on press. |
| `src/main/settings.ts` | Settings persistence via `electron-store`. `APP_SETTINGS_DEFAULTS` includes `onShow: 'fresh'` and `onHide: 'clipboard'`. |
| `src/main/soniox.ts` | WebSocket client. `finalize()` sends empty buffer. `onFinished` event fires when `response.finished === true`. |
| `src/main/index.ts` | App entry point — init order: settings, audio, theme, window, session, tray, hotkey. |
| `src/main/preload.ts` | Overlay preload — exposes `window.electronAPI` with `hideWindow()`, `requestPause()`, `requestResume()`, `getResolvedTheme()`, `onThemeChanged()`. |
| `src/preload/index.ts` | Second overlay preload — exposes `window.api` with session event listeners, `sendSessionText()`, settings invoke. |
| `src/shared/ipc.ts` | IPC channel constants. `SESSION_TEXT` is used bidirectionally for clipboard text request/response. |
| `src/shared/types.ts` | `AppSettings` interface (has `onShow: 'fresh' \| 'append'`, `onHide: 'clipboard' \| 'none'`), `SessionState`, `EditorBlock`, etc. |
| `src/shared/preload.d.ts` | Type definitions for `window.api` (`ElectronAPI`) and `window.settingsApi` (`SettingsAPI`). |
| `src/renderer/types.d.ts` | Type definitions for `window.electronAPI` (separate from `window.api`). |
| `src/renderer/overlay/OverlayContext.tsx` | Overlay UI state — `clearEditor()`, `copyText()`, `isEditorEmpty()`, keyboard shortcuts (Escape → `hideWindow()`, Ctrl+P → pause). |
| `src/renderer/overlay/editor/Editor.tsx` | Lexical editor wrapper. Creates `blockManager` and `historyState` as `useMemo` values. |
| `src/renderer/overlay/editor/TokenCommitPlugin.tsx` | Commits final tokens to Lexical via block manager. Clears undo history on commit. |
| `src/renderer/overlay/editor/editorBlockManager.ts` | Manages `EditorBlock[]` array. `commitFinalTokens()`, `getDocumentText()`, `clear()`. |
| `src/renderer/overlay/components/StatusBar.tsx` | Copy button calls `copyText()` from OverlayContext. |
| `src/renderer/overlay/components/TitleBar.tsx` | Close button calls `window.electronAPI.hideWindow()`. |
| `src/main/session.test.ts` | Comprehensive tests for session lifecycle (start, stop, pause, resume, finalization, clipboard). |
| `spec/features/text-output.md` | Spec for clipboard behavior, manual copy, clear-on-new-session. |
| `spec/hotkeys.md` | Spec for Escape (quick dismiss) vs global hotkey (finalize + clipboard). |
| `spec/features/system-tray.md` | Spec for onShow fresh/append, tray icon behavior. |
| `spec/architecture.md` | IPC table and component overview. |

## Architecture

### Subsystem: Session Lifecycle & Text Output

The app is an Electron speech-to-text transcription tool. The main process orchestrates a session lifecycle (idle → connecting → recording → paused → finalizing → idle). The renderer hosts a Lexical editor that receives tokens via IPC.

**Session flow (current state):**
1. Global hotkey or tray click → `requestToggle()` in session.ts
2. If window hidden: `showOverlay()` + `startSession()` → connect Soniox → start audio → status: recording
3. Tokens flow: Soniox → `onFinalTokens` → IPC `TOKENS_FINAL` → renderer `TokenCommitPlugin` → Lexical editor
4. If window visible: `stopSession()` → status: finalizing → stop audio → `soniox.finalize()` → wait for `finished: true` → clear ghost text → `SESSION_STOP` IPC → clipboard (if setting) → hide → status: idle

**Key gap: Escape vs hotkey hide not differentiated.**
Currently, Escape sends `WINDOW_HIDE` IPC, which routes through `requestOverlayDismiss()` → `requestToggle()` → `stopSession()`. This is identical to the global hotkey path. The spec requires Escape to hide immediately without finalization or clipboard copy.

**Key gap: Renderer text response not wired.**
`waitForClipboardText()` in session.ts sends `SESSION_TEXT` to renderer and listens for a response with `ipcMain.once(SESSION_TEXT, handler)`. But the renderer has no listener for incoming `SESSION_TEXT` — no code reads the editor text and sends it back.

**Key gap: onShow "fresh" behavior not implemented.**
The `onShow` setting exists in `AppSettings` with default `"fresh"`, but nothing in the show path checks it or clears the editor.

**Key gap: Tray icon flash not implemented.**
The tray module (`tray.ts`) creates an icon and context menu but has no flash/notification mechanism for confirming clipboard copy.

**Two preload APIs coexist:**
- `window.electronAPI` (from `src/main/preload.ts`): hideWindow, requestPause/Resume, theme
- `window.api` (from `src/preload/index.ts`): session event listeners, sendSessionText, settings

**Constraints:**
- `window.ts` must NOT import from `session.ts` (callback pattern via `setOverlayCloseHandler` avoids circular deps)
- Session IPC handlers are registered in `initSessionManager()`
- `activeTransition` guard in `requestToggle()` prevents re-entry during async stop
- Ghost text is cleared before clipboard text request (via empty `TOKENS_NONFINAL`), so `$getRoot().getTextContent()` returns committed text only at clipboard time
