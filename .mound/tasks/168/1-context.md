# Context

## Relevant Files
- `src/renderer/overlay/audio-capture.ts` — Overlay audio capture module. Contains `startAudioCapture()`, `stopAudioCapture()`, and the unused `enumerateAudioInputDevices()` to be removed.

## Architecture
`audio-capture.ts` provides WebAudio-based microphone capture for the overlay renderer. It uses `getUserMedia` + AudioWorklet to capture PCM audio. The `enumerateAudioInputDevices()` function at lines 185-201 is dead code — device enumeration now lives in the settings preload. No other source files import or call this function.
