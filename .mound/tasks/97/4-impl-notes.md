# Implementation Notes

## Files modified

- `src/main/audio.ts` — Changed `registerAudioIpc()` to return `listDevices().map(d => d.name)` instead of `[]`
- `src/main/audio.test.ts` — Updated test to assert handler returns input device names instead of empty array
- `src/renderer/settings/index.tsx` — Added `focus` event listener to re-fetch audio devices when settings window regains focus
- `spec/architecture.md` — Added `audio:get-devices` IPC channel to the IPC Messages table

## Deviations from plan

None.

## New tasks or follow-up work

None discovered.
