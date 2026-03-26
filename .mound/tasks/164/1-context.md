# Context

## Relevant Files

- `spec/models.md` — Data model spec; contains stale PortAudio reference in `AppSettings.audioInputDevice` comment (line 116)
- `src/renderer/overlay/audio-capture.ts` — Current getUserMedia-based audio capture implementation; shows device label-based selection model
- `src/shared/types.ts` — TypeScript `AppSettings` interface; `audioInputDevice: string | null` with no PortAudio comment

## Architecture

`audioInputDevice` stores a `MediaDeviceInfo.label` string (or `null` for system default). At capture time, `startAudioCapture()` resolves the label to a `deviceId` via `enumerateDevices()`, then passes `{ deviceId: { exact: id } }` to `getUserMedia`. The `enumerateAudioInputDevices()` function returns device labels for the settings UI dropdown.

Task 142 replaced the naudiodon/PortAudio native addon with this renderer-side `getUserMedia` + AudioWorklet pipeline. The spec comment still says "PortAudio device name".
