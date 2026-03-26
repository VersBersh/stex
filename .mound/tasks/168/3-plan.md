# Plan

## Goal
Remove the unused `enumerateAudioInputDevices()` function from `src/renderer/overlay/audio-capture.ts`.

## Steps
1. **Remove the function** — Delete lines 185-201 (the `enumerateAudioInputDevices()` export) from `src/renderer/overlay/audio-capture.ts`. Also remove the trailing blank line before it (line 184) to keep formatting clean.

## Risks / Open Questions
None — the function has zero callers in the codebase.
