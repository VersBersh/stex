# Context — Task 88

## Relevant Files

| File | Role |
|------|------|
| `src/main/session.ts` | Session manager — defines `sendToRenderer`, `sendStatus`, `sendError`, `clearError` as private functions. Uses them extensively for all renderer communication. |
| `src/main/soniox-lifecycle.ts` | Manages Soniox WebSocket lifecycle. Does NOT directly use send functions — receives callbacks (`SonioxLifecycleCallbacks`) that bridge to renderer messaging. |
| `src/main/soniox-lifecycle.test.ts` | Tests for soniox-lifecycle. Uses mock callbacks, no direct renderer communication. |
| `src/main/session.test.ts` | Tests for session manager. Mocks `getOverlayWindow` and asserts `webContents.send` calls. |
| `src/main/session-ipc.ts` | IPC handler registration — listens for renderer-to-main messages. Separate concern from main-to-renderer sends. |
| `src/main/window.ts` | Window management — exports `getOverlayWindow()` used by `sendToRenderer`. |
| `src/shared/ipc.ts` | `IpcChannels` constants used as channel names for all IPC communication. |
| `src/shared/types.ts` | Shared types including `ErrorInfo`, `SessionState`, `SonioxToken`. |

## Architecture

The session subsystem manages the transcription session lifecycle (start → recording → pause → resume → stop). Communication flows in two directions:

1. **Renderer → Main**: Handled by `session-ipc.ts` which registers `ipcMain.on` listeners for pause/resume/dismiss etc.
2. **Main → Renderer**: Handled by `sendToRenderer()` in `session.ts` which calls `win.webContents.send()`. Higher-level helpers `sendStatus()` and `sendError()` build on this.

The `sendToRenderer` function depends on `getOverlayWindow()` from `window.ts` and includes a guard for destroyed windows. It is used:
- Directly in session.ts (~15 call sites) for tokens, status, session events
- Indirectly via `sendStatus()` and `sendError()` helpers
- Via `createLifecycleCallbacks()` which bridges soniox-lifecycle events to renderer messages

`soniox-lifecycle.ts` does NOT import or call send functions — it uses the `SonioxLifecycleCallbacks` interface. The task description's mention of soniox-lifecycle importing from the new module is incorrect; only session.ts needs to import.
