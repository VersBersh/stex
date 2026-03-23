# Context

## Relevant Files

- `src/main/audio.ts` — Audio capture logic: `listDevices()`, `startCapture()`, `stopCapture()`, `registerAudioIpc()`. The IPC handler currently returns `[]` instead of actual devices.
- `src/main/audio.test.ts` — Tests for audio module. Includes test asserting empty array from IPC handler (needs update).
- `src/renderer/settings/pages/General.tsx` — Settings General tab with audio device dropdown UI already in place.
- `src/renderer/settings/index.tsx` — Settings page controller. Fetches audio devices on mount via `getAudioDevices()`.
- `src/preload/settings-preload.ts` — Preload bridge exposing `getAudioDevices()` to renderer via IPC.
- `src/shared/preload.d.ts` — Type definitions for `SettingsAPI` (includes `getAudioDevices(): Promise<string[]>`).
- `src/shared/types.ts` — `AudioDevice` interface, `AppSettings` interface (includes `audioInputDevice: string | null`).
- `src/shared/ipc.ts` — IPC channel constants including `AUDIO_GET_DEVICES`.
- `src/main/settings.ts` — Settings persistence using electron-store.

## Architecture

**stex** is an Electron desktop app for live speech-to-text transcription. The architecture follows Electron's main/renderer/preload split:

- **Main process** (`src/main/`): Manages audio capture via naudiodon (PortAudio wrapper), WebSocket connection to Soniox API, and settings persistence via electron-store.
- **Preload** (`src/preload/`): Bridges main ↔ renderer via IPC. `settings-preload.ts` exposes a `settingsApi` object.
- **Renderer** (`src/renderer/`): React-based UI. Settings window has tabbed layout (API Key, Hotkeys, General).

**Audio device selection flow:**
1. Renderer calls `window.settingsApi.getAudioDevices()` → IPC → main process `registerAudioIpc()` handler
2. User selects device → `setSetting('audioInputDevice', deviceName)` → persisted by electron-store
3. On transcription start, `startCapture()` reads `audioInputDevice` from settings, resolves name→ID via `listDevices()`, passes ID to PortAudio

**Key constraint:** Device selection uses device *names* (strings) for persistence, not numeric IDs, since IDs can change between sessions. The `SettingsAPI.getAudioDevices()` returns `string[]` (device names only).
