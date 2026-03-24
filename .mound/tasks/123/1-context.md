# Context

## Relevant Files

| File | Role |
|------|------|
| `src/shared/types.ts` | Shared types including `AppSettings`, `SessionState` |
| `src/shared/ipc.ts` | IPC channel name constants |
| `src/shared/preload.d.ts` | Type declarations for `window.api` (overlay) and `window.settingsApi` (settings) |
| `src/main/settings.ts` | Settings store (electron-store), `getSettings()`, `setSetting()`, `APP_SETTINGS_DEFAULTS`, IPC registration |
| `src/main/audio.ts` | Audio capture via naudiodon/PortAudio; `startCapture(onData, onError)` streams PCM s16le 16kHz mono chunks |
| `src/main/session.ts` | Session manager orchestrating start/stop/pause; creates lifecycle callbacks forwarding tokens via IPC |
| `src/main/soniox-lifecycle.ts` | Manages Soniox connection lifecycle; routes audio chunks via `onAudioData(chunk)` callback |
| `src/main/renderer-send.ts` | Helper to send IPC messages to the overlay renderer |
| `src/preload/index.ts` | Overlay preload bridge — exposes `window.api` with IPC send/invoke/listen methods |
| `src/preload/settings-preload.ts` | Settings preload bridge — exposes `window.settingsApi` |
| `src/renderer/overlay/OverlayContext.tsx` | React context providing session state, pause control, error handling to overlay UI |
| `src/renderer/overlay/components/StatusBar.tsx` | Status bar component showing mic state, pause/resume, clear, copy buttons |
| `src/renderer/overlay/index.tsx` | Overlay app entry — renders TitleBar, Editor, ErrorBanner, StatusBar inside OverlayProvider |
| `src/renderer/overlay/overlay.css` | Overlay CSS with CSS custom properties for light/dark themes |
| `src/renderer/settings/index.tsx` | Settings app entry with tabbed layout (api-key, hotkeys, general) |
| `src/renderer/settings/pages/General.tsx` | General settings page — theme, on-show/hide behavior, audio device, model, language, endpoint delay |
| `src/renderer/settings/settings.css` | Settings CSS with CSS custom properties for light/dark themes |
| `src/main/settings.test.ts` | Test patterns: vitest, mocked electron-store, mocked electron IPC |
| `spec/architecture.md` | Architecture spec documenting data flow, IPC channels, file structure |
| `spec/ui.md` | UI spec for overlay layout, status bar, themes |
| `spec/proposal-context-refresh.md` | Context refresh proposal that will consume the silence threshold for VAD |

## Architecture

The app is an Electron desktop application with three processes:

1. **Main process**: Orchestrates audio capture (naudiodon/PortAudio producing PCM s16le 16kHz mono), Soniox WebSocket connection, settings store (electron-store), session lifecycle.

2. **Overlay renderer**: Frameless always-on-top window with a Lexical editor showing live transcription. React-based with `OverlayProvider` context managing session state. Communicates with main via `window.api` (preload bridge).

3. **Settings renderer**: Tabbed settings window. Communicates with main via `window.settingsApi` (preload bridge).

**Audio data flow**: `naudiodon` -> `startCapture(onData)` -> `soniox-lifecycle.onAudioData(chunk)` -> `soniox.sendAudio(chunk)`. The `onData` callback receives raw PCM `Buffer` chunks.

**Settings pattern**: `AppSettings` interface in `types.ts`, defaults in `settings.ts`, stored via `electron-store`. IPC: renderer calls `settings:set` -> main validates key, calls `setSetting()` -> broadcasts `settings:updated` to all windows. Both renderers subscribe via `onSettingsUpdated`.

**IPC pattern**: Channel names in `ipc.ts`, preload bridges expose typed methods, type declarations in `preload.d.ts`.

**Audio level computation point**: The `onData` callback in `soniox-lifecycle.ts:onAudioData` is the natural place to compute RMS/dB from PCM chunks. This is where every audio chunk passes through during active recording.
