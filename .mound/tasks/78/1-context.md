# Context — Task 78

## Relevant Files

| File | Role |
|------|------|
| `src/main/session.ts` | Session orchestrator — 425 lines. Owns IPC registration, Soniox lifecycle, session state machine, clipboard behavior, reconnect orchestration, and overlay control. Target of decomposition. |
| `src/main/session.test.ts` | Main session tests — covers start/stop/pause/resume, token forwarding, clipboard, quick dismiss, API key guard. Imports `initSessionManager`, `requestToggle`, `requestQuickDismiss`. |
| `src/main/session-reconnect.test.ts` | Reconnection-focused tests — exponential backoff, reconnectable vs non-reconnectable errors, IPC handler registration (dismiss-error, open-settings, open-mic-settings). |
| `src/main/soniox.ts` | `SonioxClient` class — WebSocket wrapper that connects to Soniox STT, emits events (`onConnected`, `onFinalTokens`, `onNonFinalTokens`, `onFinished`, `onDisconnected`, `onError`). |
| `src/main/error-classification.ts` | Pure functions `classifyAudioError` and `classifyDisconnect` — extracted by task 68. |
| `src/main/reconnect-policy.ts` | Pure function `getReconnectDelay` — exponential backoff with cap, extracted by task 68. |
| `src/main/window.ts` | Window manager — creates overlay, show/hide/settings windows, close handler delegation via `setOverlayCloseHandler`. |
| `src/main/audio.ts` | Audio capture — `startCapture(onData, onError)` and `stopCapture()`. |
| `src/main/settings.ts` | Settings store — `getSettings()`, `setSetting()`. |
| `src/main/tray.ts` | Tray icon — `flashTrayIcon()`. |
| `src/main/index.ts` | App entry — calls `initSessionManager()`. |
| `src/shared/ipc.ts` | `IpcChannels` constant object — all channel names. |
| `src/shared/types.ts` | Shared types — `SessionState`, `SonioxToken`, `ErrorInfo`, `AppSettings`, etc. |

## Architecture

`session.ts` is the central orchestrator for the dictation session lifecycle in the main process. It currently handles:

1. **IPC handler registration** (`initSessionManager`) — registers `ipcMain.on` listeners for 6 channels (pause, resume, dismiss-error, open-settings, open-mic-settings, escape-hide) and manages their cleanup on re-init.

2. **Soniox client lifecycle** — creates `SonioxClient` instances with event callbacks, manages `connect`/`disconnect`/`finalize` calls, and wires token forwarding to the renderer.

3. **Session state machine** — manages `status` transitions (idle → connecting → recording → paused → finalizing → idle, with error/reconnecting branches).

4. **Reconnect orchestration** — uses `getReconnectDelay` and `classifyDisconnect` to schedule reconnect attempts with backoff.

5. **Clipboard behavior** — `waitForClipboardText()` and clipboard write on session stop.

6. **Renderer communication** — `sendToRenderer`, `sendStatus`, `sendError` helpers.

The module exports three functions: `initSessionManager()`, `requestToggle()`, `requestQuickDismiss()`. All internal state is module-level variables.

Task 68 previously extracted `error-classification.ts` and `reconnect-policy.ts` as pure function modules. This task continues by extracting IPC wiring and Soniox lifecycle into separate modules.
