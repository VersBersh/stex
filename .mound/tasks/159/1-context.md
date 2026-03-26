# Context

## Relevant Files

- `src/main/index.ts` — App initialization; calls all `init*` functions in sequence, where the new `initPermissions()` will be added.
- `src/main/window.ts` — Creates overlay and settings BrowserWindow instances. Both use the default session (no custom session specified). The settings window (line 262) and overlay window (line 89) are the two WebContents that need mic access.
- `src/preload/settings-preload.ts` — Settings window preload bridge. Contains `getAudioDevices()` (line 20-35) which currently bootstraps a temporary `getUserMedia()` call to get device labels.
- `src/shared/preload.d.ts` — Type definitions for `SettingsAPI` (line 43-53), including `getAudioDevices(): Promise<string[]>`.
- `src/renderer/settings/index.tsx` — Settings React app root. Calls `getAudioDevices()` (line 35, 42) and passes result as `string[]` to `General` component.
- `src/renderer/settings/pages/General.tsx` — Audio device dropdown UI (line 76-92). Receives `audioDevices: string[]` prop.
- `src/renderer/overlay/audio-capture.ts` — Overlay audio capture. Calls `getUserMedia()` directly (line 114). Also has an unused `enumerateAudioInputDevices()` with the same bootstrap pattern (line 185-201).
- `src/main/audio.ts` — Main process audio IPC relay. Tells overlay renderer to start/stop capture via IPC.
- `src/shared/ipc.ts` — IPC channel constants.
- `src/shared/types.ts` — `AppSettings` type definition.
- `src/main/settings-window.test.ts` — Existing tests for settings window creation.
- `src/preload/settings-preload.test.ts` — Existing tests for settings preload bridge.

## Architecture

The app is an Electron-based speech-to-text overlay with two windows:

1. **Overlay window** — Frameless, always-on-top transcription UI. Audio capture happens in this renderer via `getUserMedia()` + AudioWorklet, with PCM chunks relayed to main process via IPC.
2. **Settings window** — Standard framed window for configuration. Enumerates audio input devices to populate a device selection dropdown.

Both windows use Electron's **default session** (no custom sessions configured). Both need microphone access:
- Overlay: for actual audio capture during transcription sessions
- Settings: for `enumerateDevices()` to return device labels (requires prior mic permission grant)

Currently, `enumerateDevices()` labels are unlocked by a throwaway `getUserMedia()` call in the settings preload. This is fragile on fresh installs where no prior permission exists.

No Electron permission handlers (`setPermissionRequestHandler`, `setPermissionCheckHandler`) are currently configured anywhere in the codebase.
