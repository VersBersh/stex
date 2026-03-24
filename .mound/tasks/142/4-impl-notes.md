# Implementation Notes

## Files created
- `src/renderer/overlay/audio-capture.ts` — New renderer-side audio capture module using getUserMedia + AudioWorklet with inline processor source

## Files modified
- `src/shared/ipc.ts` — Added 4 new IPC channels (AUDIO_START_CAPTURE, AUDIO_STOP_CAPTURE, AUDIO_CHUNK, AUDIO_CAPTURE_ERROR), removed AUDIO_GET_DEVICES
- `src/shared/types.ts` — Removed AudioDevice interface (no longer used)
- `src/shared/preload.d.ts` — Added 4 new methods to ElectronAPI for audio capture IPC
- `src/preload/index.ts` — Added audio capture IPC bridge methods
- `src/preload/settings-preload.ts` — Changed getAudioDevices from IPC invoke to direct navigator.mediaDevices.enumerateDevices()
- `src/renderer/overlay/OverlayContext.tsx` — Added useEffect for audio capture start/stop IPC commands
- `src/main/audio.ts` — Complete rewrite: replaced naudiodon/PortAudio with IPC-based relay to renderer
- `package.json` — Removed naudiodon dependency and node-gyp override
- `webpack.main.config.js` — Removed naudiodon external
- `spec/architecture.md` — Updated Audio Capture component, data flow, IPC table, tech stack, file structure
- `src/main/audio.test.ts` — Complete rewrite to test IPC-based audio module
- `src/preload/index.test.ts` — Added tests for new audio capture preload methods
- `src/preload/settings-preload.test.ts` — Updated getAudioDevices test (no longer IPC-based)

## Deviations from plan
- Removed `AUDIO_GET_DEVICES` IPC channel constant entirely since nothing references it after the migration (plan mentioned keeping it as fallback, but cleaner to remove)

## Review fixes applied
- **Device fallback → error**: Changed `startAudioCapture` to throw `"Audio device not found: {name}"` when a non-null device name has no match, instead of silently falling back to default
- **Error normalization**: Wrapped the entire capture setup in try/catch inside `startAudioCapture`, using `normalizeAudioError()` to convert DOMExceptions to messages compatible with `classifyAudioError()` in main process
- **Tail audio flush**: Added `flush` message handling to the AudioWorklet processor — `stopAudioCapture()` sends a flush command before disconnecting, ensuring partial batches are posted
- **package-lock.json**: Regenerated via `npm install` to remove naudiodon/node-gyp entries

## New tasks or follow-up work
- Consider adding Electron `session.setPermissionRequestHandler` to auto-grant mic permission in settings window for consistent device enumeration
- Device name matching between PortAudio names and browser names may differ — user notification or migration logic could be added
- Update `README.md` to remove naudiodon/node-gyp build instructions
- Update `spec/decisions.md` to reflect that the naudiodon fallback plan was exercised (decision D4)
- The `enumerateAudioInputDevices()` in `audio-capture.ts` is currently unused — settings preload duplicates the logic. Could be deduplicated if both are in the same renderer context.
