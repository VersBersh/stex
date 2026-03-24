# Implementation Notes

## Files created
- `src/main/audio-level-monitor.ts` — Pure dB computation and rolling average monitor
- `src/main/audio-level-monitor.test.ts` — Unit tests for audio level monitor
- `src/renderer/overlay/components/VolumeMeter.tsx` — Volume meter bar component for overlay

## Files modified
- `src/shared/types.ts` — Added `silenceThresholdDb: number` to `AppSettings`, added `SILENCE_THRESHOLD_MIN`/`MAX` constants
- `src/shared/ipc.ts` — Added `AUDIO_LEVEL` channel
- `src/shared/preload.d.ts` — Added `onAudioLevel` to `ElectronAPI`
- `src/main/settings.ts` — Added `silenceThresholdDb: -30` default, clamping on set
- `src/main/soniox-lifecycle.ts` — Integrated audio level monitor, added `onAudioLevel` callback
- `src/main/session.ts` — Forwarded audio level to renderer via IPC
- `src/preload/index.ts` — Added `onAudioLevel` listener bridge
- `src/renderer/overlay/OverlayContext.tsx` — Added `audioLevelDb` state, subscription, and reset on non-recording status
- `src/renderer/overlay/components/StatusBar.tsx` — Added VolumeMeter between mic icon and status text
- `src/renderer/overlay/overlay.css` — Added volume meter styles
- `src/renderer/settings/pages/General.tsx` — Added silence threshold slider with visual scale, using shared constants
- `src/renderer/settings/settings.css` — Added threshold scale/marker styles
- `src/main/settings.test.ts` — Updated defaults assertion
- `src/preload/index.test.ts` — Added `onAudioLevel` to listener methods list
- `spec/architecture.md` — Added `audio:level` IPC channel, `silenceThresholdDb` mention
- `spec/ui.md` — Added Volume Meter and Silence Threshold sections
- `spec/models.md` — Added `silenceThresholdDb` to AppSettings spec

## Deviations from plan
- Added `SILENCE_THRESHOLD_MIN`/`MAX` shared constants and clamping in `setSetting()` (review feedback — centralize range validation)
- Added `audioLevelDb` reset to -60 on status transitions away from recording (review feedback — prevent stale meter state)
- Added `windowSize` guard in `createAudioLevelMonitor` (review feedback — prevent NaN)
- Updated `spec/models.md` in addition to the planned spec files (review feedback)

## New tasks or follow-up work
- Sound event logging (stretch goal from task description) — not implemented
- "Test microphone" feature for settings window to show live audio level
- IPC throttling for audio level if performance becomes an issue at high chunk rates
- Split `settings.test.ts` by concern (currently 416 lines, flagged as code smell)
