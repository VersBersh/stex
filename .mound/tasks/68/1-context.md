# Context — Task 68: Decompose session.ts

## Relevant Files

- `src/main/session.ts` — The file to decompose. 446 lines handling session state transitions, Soniox lifecycle, audio capture, reconnect policy, error classification, clipboard behavior, overlay/window orchestration, and IPC wiring.
- `src/main/session.test.ts` — 700-line test file covering core session lifecycle (start/pause/resume/stop, token forwarding, finalization, API key guard).
- `src/main/session-reconnect.test.ts` — 497-line test file covering error handling, reconnection with exponential backoff, error classification, audio errors, and error-action IPC handlers.
- `src/shared/types.ts` — Defines `ErrorInfo` (type union: `'api-key' | 'rate-limit' | 'mic-denied' | 'mic-unavailable' | 'network' | 'no-api-key' | 'unknown'`), `SessionState`, `SonioxToken`, and `AppSettings`.
- `src/shared/ipc.ts` — IPC channel constants.
- `src/main/soniox.ts` — Soniox WebSocket client.
- `src/main/audio.ts` — Audio capture (`startCapture`, `stopCapture`).
- `src/main/window.ts` — Overlay/settings window management.
- `src/main/settings.ts` — Settings persistence.
- `vitest.config.ts` — Test config: includes `src/**/*.test.ts`.

## Architecture

`session.ts` is the central orchestrator for the main Electron process. It manages:

1. **Session state machine** — Status transitions: idle → connecting → recording ⇄ paused → finalizing → idle, with error/reconnecting branches.
2. **Soniox lifecycle** — Creates `SonioxClient`, connects with settings, handles callbacks (tokens, disconnect, error).
3. **Audio capture** — Starts/stops audio capture, pipes chunks to Soniox.
4. **Reconnect policy** — Exponential backoff (1s initial, 2x multiplier, 30s cap) via `scheduleReconnect()`, `attemptReconnect()`, `cancelReconnect()`. Module-level state: `reconnectTimer`, `reconnectAttempt`.
5. **Error classification** — `classifyAudioError(err)` maps audio errors to `ErrorInfo` types; `classifyDisconnect(code, reason)` maps WebSocket disconnect codes to `{ reconnectable, error }`.
6. **Clipboard** — `waitForClipboardText()` on stop when `onHide === 'clipboard'`.
7. **IPC wiring** — Registers handlers for pause/resume/dismiss-error/open-settings/open-mic-settings.
8. **Window orchestration** — Shows/hides overlay via toggle logic including API key guard.

Key constraints:
- Pure refactor — no behavioral changes allowed.
- Both test files import only `initSessionManager` and `requestToggle` from `./session` — the extracted modules will be internal to `session.ts` (imported by session.ts, not directly by tests).
- The `ErrorInfo` type is defined in `shared/types.ts` and is already shared.
- Reconnect state (`reconnectTimer`, `reconnectAttempt`) is module-level in session.ts currently.
