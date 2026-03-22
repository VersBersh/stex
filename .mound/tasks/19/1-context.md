# Context

## Relevant Files

- `src/main/index.ts` — App bootstrap; initializes all managers in sequence. Will add first-run detection here.
- `src/main/session.ts` — Session lifecycle (start/pause/resume/stop); `requestToggle()` is the hotkey handler entry point. Will add API key guard here.
- `src/main/settings.ts` — Settings store backed by `electron-store`; `getSettings()` returns resolved settings incl. API key fallback from env var.
- `src/main/hotkey.ts` — Global hotkey registration; already handles registration failure with system notification.
- `src/main/window.ts` — Overlay and settings window management; `showOverlay()`, `hideOverlay()`, `showSettings()`.
- `src/main/audio.ts` — Audio capture via naudiodon; mic errors bubble up to session.ts error handlers.
- `src/shared/types.ts` — Shared types including `ErrorInfo` (error type union), `AppSettings`, `SessionState`.
- `src/shared/ipc.ts` — IPC channel constants. Includes `SESSION_ERROR`, `SESSION_OPEN_SETTINGS` etc.
- `src/renderer/overlay/OverlayContext.tsx` — React context for overlay; handles error display, error actions (open-settings, open-mic-settings).
- `src/renderer/overlay/components/ErrorBanner.tsx` — Renders error messages with action buttons; already supports `open-settings` action.
- `src/renderer/overlay/components/StatusBar.tsx` — Status bar; already shows "Microphone access denied" for `mic-denied` errors.
- `src/main/session.test.ts` — Session manager tests; will add tests for no-API-key guard.
- `src/main/hotkey.test.ts` — Hotkey manager tests; hotkey conflict already tested.
- `spec/features/system-tray.md` — Spec for first-run experience, mic permission, hotkey failure.

## Architecture

The app is an Electron tray-resident app. The main process (`src/main/index.ts`) bootstraps managers sequentially:
1. `registerSettingsIpc()` — settings IPC handlers
2. `registerAudioIpc()` — audio device listing
3. `initThemeManager()` — system theme tracking
4. `initWindowManager()` — creates overlay window (hidden) and registers IPC
5. `initSessionManager()` — session lifecycle IPC handlers
6. `initTray()` — system tray icon and menu
7. `initHotkeyManager()` — global shortcut registration

**Session flow**: `requestToggle()` is the single entry point for hotkey/tray "Show/Hide". When overlay is hidden: show overlay + start session. When visible: stop session + hide overlay. Sessions connect a WebSocket to Soniox, capture audio, and forward transcription tokens to the renderer.

**Error infrastructure**: `ErrorInfo` has typed errors (`api-key`, `mic-denied`, `network`, etc.) with optional `action` objects. Main process sends errors via `SESSION_ERROR` IPC. The overlay's `ErrorBanner` component renders the message and action button. `handleErrorAction()` in `OverlayContext` dispatches to `openSettings()` or `openMicSettings()` based on the action string.

**Settings**: `electron-store` persists to `settings.json` automatically. `getSettings()` resolves the API key with env var fallback. The settings window is a separate BrowserWindow with its own preload.

**Key constraint**: The overlay window is created once at startup (hidden) and reused — hidden/shown, never destroyed. React state persists across show/hide cycles, so errors must be explicitly cleared.
