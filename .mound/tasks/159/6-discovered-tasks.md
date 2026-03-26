# Discovered Tasks

## 1. AUDIO: Remove unused `enumerateAudioInputDevices()` from audio-capture.ts
- **Description**: The `enumerateAudioInputDevices()` function exported from `src/renderer/overlay/audio-capture.ts` (lines 185-201) is dead code. It duplicates the device enumeration logic from the settings preload and still contains the old `getUserMedia()` bootstrap pattern. It should be removed.
- **Why discovered**: While reviewing the codebase for all `getUserMedia()` bootstrap calls, this unused function was identified. Task 142 impl notes also flagged it as unused.
