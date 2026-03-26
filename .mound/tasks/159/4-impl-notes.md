# Implementation Notes

## Files created
- `src/main/permissions.ts` — New module configuring Electron session permission handlers (check + request)
- `src/main/permissions.test.ts` — Unit tests for the permissions module

## Files modified
- `src/main/index.ts` — Added `initPermissions()` call between theme and window init
- `src/shared/preload.d.ts` — Added `AudioDeviceResult` interface; changed `getAudioDevices` return type
- `src/preload/settings-preload.ts` — Removed `getUserMedia()` bootstrap; returns `{ devices, labelsUnavailable }` with label-empty heuristic
- `src/renderer/settings/index.tsx` — Destructures new result type; tracks `micLabelsUnavailable` state; passes to General
- `src/renderer/settings/pages/General.tsx` — Added `micLabelsUnavailable` prop and warning message
- `src/renderer/settings/settings.css` — Added `--warning-color` CSS variable (light + dark) and `.hint.warning` rule
- `src/main/first-run.test.ts` — Added mock for `./permissions` module and assertion for `initPermissions` call

## Deviations from plan
- Permission check handler uses an explicit allowlist (`media`, `clipboard-sanitized-write`, `clipboard-read`) instead of blanket `true`, per design review feedback.
- Renamed `permissionDenied` to `labelsUnavailable` throughout, and softened the UI warning message, per design review feedback.

## New tasks or follow-up work
- The unused `enumerateAudioInputDevices()` in `src/renderer/overlay/audio-capture.ts` (lines 185-201) still contains the old `getUserMedia()` bootstrap pattern. It should be removed since it's dead code (noted in task 142 impl notes as well).
