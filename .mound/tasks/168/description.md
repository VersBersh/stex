# AUDIO: Remove unused enumerateAudioInputDevices() from audio-capture.ts

## Summary
The `enumerateAudioInputDevices()` function exported from `src/renderer/overlay/audio-capture.ts` is dead code. It duplicates the device enumeration logic that now lives in the settings preload and still contains the old `getUserMedia()` bootstrap pattern. It was flagged as unused during the naudiodon-to-getUserMedia migration (task 142) and again during task 159 (Electron permission handler for mic access). It should be removed to reduce confusion and dead code.

## Acceptance criteria
- The `enumerateAudioInputDevices()` function is removed from `src/renderer/overlay/audio-capture.ts`
- No remaining references to the removed function exist in the codebase
- All existing tests pass after removal
- If any imports referenced this function, they are cleaned up

## References
- Source: .mound/tasks/159/6-discovered-tasks.md (discovered during task 159 — Add Electron permission handler for mic access)
- File: src/renderer/overlay/audio-capture.ts
- Related: task 142 (Replace naudiodon/PortAudio with getUserMedia)
