# Context

## Relevant Files

| File | Role |
|------|------|
| `src/main/audio.ts` | Current naudiodon/PortAudio audio capture — `startCapture()`, `stopCapture()`, `listDevices()`, `registerAudioIpc()`. **Primary replacement target.** |
| `src/main/soniox-lifecycle.ts` | Orchestrates audio+Soniox lifecycle. Calls `startCapture(onAudioData, onAudioError)` and `stopCapture()`. Contains `onAudioData()` which forwards chunks to Soniox and computes dB levels. |
| `src/main/session.ts` | Session manager. Calls `startCapture`/`stopCapture` via `soniox-lifecycle.ts`. Manages state transitions (idle→connecting→recording→paused→finalizing→idle). |
| `src/main/audio-level-monitor.ts` | Pure functions: `computeDbFromPcm16(chunk)`, `createAudioLevelMonitor()`, `createSoundEventDetector()`. Used by `soniox-lifecycle.ts` to process PCM chunks. **No changes needed** — still receives Buffer chunks. |
| `src/main/error-classification.ts` | `classifyAudioError()` maps audio errors to `ErrorInfo` types. May need updates for new error messages from getUserMedia. |
| `src/main/renderer-send.ts` | `sendToRenderer()` sends IPC messages to the overlay window. Used throughout session/lifecycle code. |
| `src/main/index.ts` | App initialization. Calls `registerAudioIpc()`. |
| `src/shared/ipc.ts` | IPC channel name constants. Needs new channels for audio capture commands and chunk data. |
| `src/shared/types.ts` | Shared types including `AudioDevice`, `AppSettings`. `AudioDevice` has numeric `id` from PortAudio — needs update. |
| `src/shared/preload.d.ts` | Type declarations for `window.api` (ElectronAPI) and `window.settingsApi` (SettingsAPI). Needs new audio capture methods on ElectronAPI. |
| `src/preload/index.ts` | Overlay preload bridge — exposes `window.api`. Needs new methods for audio capture IPC. |
| `src/preload/settings-preload.ts` | Settings preload bridge — exposes `window.settingsApi`. `getAudioDevices()` currently invokes main-process handler. |
| `src/renderer/overlay/OverlayContext.tsx` | Overlay React context. Subscribes to session status, audio levels, etc. Will need to integrate renderer-side audio capture. |
| `src/renderer/settings/pages/General.tsx` | Settings page with audio device dropdown. Currently receives `audioDevices: string[]` prop populated via IPC from PortAudio. |
| `src/renderer/settings/index.tsx` | Settings app root. Calls `settingsApi.getAudioDevices()` to populate device list. |
| `src/main/window.ts` | Window creation. Overlay and settings windows with preload scripts. No permission handlers for media currently set. |
| `webpack.main.config.js` | Main process webpack. Has `naudiodon` as external. Needs cleanup. |
| `webpack.renderer.config.js` | Renderer webpack. May need config for AudioWorklet processor file. |
| `package.json` | Has `naudiodon` dependency. Needs removal. |
| `src/main/audio.test.ts` | Tests for current naudiodon-based audio.ts. **Must be rewritten.** |
| `src/main/soniox-lifecycle.test.ts` | Tests for soniox-lifecycle. Mocks `./audio` — mock shape may need updating. |
| `src/main/session.test.ts` | Tests for session.ts. Mocks `./audio` — mock shape may need updating. |
| `src/main/first-run.test.ts` | Tests initApp(). Mocks `registerAudioIpc`. |
| `src/preload/index.test.ts` | Preload bridge tests. Needs new method tests. |
| `spec/architecture.md` | Architecture spec. References naudiodon/PortAudio — needs update. |

## Architecture

### Audio Capture Subsystem (Current)

The audio capture runs entirely in the **main process** via `naudiodon` (Node.js bindings for PortAudio):

1. `session.ts` starts a session → connects Soniox WebSocket
2. On WebSocket connected → `soniox-lifecycle.ts` calls `audio.startCapture(onAudioData, onAudioError)`
3. `audio.ts` opens a PortAudio stream (PCM s16le, 16kHz, mono) and emits `data` events with `Buffer` chunks
4. `onAudioData()` in `soniox-lifecycle.ts` forwards chunks to `soniox.sendAudio(chunk)` and computes dB via `computeDbFromPcm16()`
5. Smoothed dB is sent to the renderer via IPC (`audio:level` channel) for the volume meter
6. On pause/stop → `audio.stopCapture()` closes the PortAudio stream

### Device Selection (Current)

- `audio.listDevices()` queries PortAudio for input devices, filters to WASAPI on Windows
- `registerAudioIpc()` registers a handler for `audio:get-devices` IPC from the settings renderer
- Settings UI shows device names in a dropdown; selected name stored in `AppSettings.audioInputDevice`
- On capture start, the name is resolved to a PortAudio numeric device ID

### Key Constraints

- PCM format must remain **s16le 16kHz mono** — this is what the Soniox WebSocket expects
- `onAudioData(chunk: Buffer)` interface in `soniox-lifecycle.ts` must continue receiving `Buffer` chunks
- Audio level monitoring (`computeDbFromPcm16`) operates on these same Buffer chunks
- Device selection stores the device **name** as a string (not numeric ID)
- The overlay renderer is the only window that needs audio capture; the settings window only needs device enumeration
- There is no explicit media permission handler in `window.ts` — default Chromium behavior applies
