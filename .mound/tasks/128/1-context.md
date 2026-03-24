# Context

## Relevant Files

- `src/main/audio-level-monitor.ts` — Defines `MIN_DB = -60`, `computeDbFromPcm16()`, and `createAudioLevelMonitor()` moving average smoother. `MIN_DB` is currently a module-local constant (not exported).
- `src/main/soniox-lifecycle.ts` — Manages Soniox WebSocket lifecycle. Contains `handleDisconnect()` (line 75), `onAudioError()` (line 102), and `onAudioData()` (line 93) which computes and sends dB via `activeCallbacks.onAudioLevel`. Also has an `onError` handler in `connectSoniox()` (line 159) that calls `stopCapture()`.
- `src/main/session.ts` — Session lifecycle manager. `pauseSession()` (line 111) and `stopSession()` (line 145) call `stopCapture()`. `requestQuickDismiss()` (line 211) also calls `stopCapture()`. Creates lifecycle callbacks via `createLifecycleCallbacks()` (line 46) which pipes `onAudioLevel` to renderer via IPC.
- `src/main/renderer-send.ts` — Helper to send IPC messages to the renderer overlay window.
- `src/renderer/overlay/components/VolumeMeter.tsx` — Pure render component: maps dB to a bar width percentage. No internal state or transitions.
- `src/renderer/overlay/components/StatusBar.tsx` — Renders `VolumeMeter` conditionally: `{sessionStatus === 'recording' && <VolumeMeter dB={audioLevelDb} />}`.
- `src/renderer/overlay/OverlayContext.tsx` — Holds `audioLevelDb` state. Already resets to -60 when status changes to non-recording (line 129-131). Subscribes to `onAudioLevel` IPC at line 144-146.
- `src/shared/ipc.ts` — IPC channel constants. `AUDIO_LEVEL: 'audio:level'`.
- `src/preload/index.ts` — Exposes `onAudioLevel` API to renderer.
- `src/main/session.test.ts` — Comprehensive session manager tests.
- `src/main/soniox-lifecycle.test.ts` — Soniox lifecycle tests.

## Architecture

Audio level monitoring flows: `audio capture` -> `onAudioData()` in soniox-lifecycle -> `computeDbFromPcm16()` + `AudioLevelMonitor.push()` -> `activeCallbacks.onAudioLevel(smoothedDb)` -> `sendToRenderer(IpcChannels.AUDIO_LEVEL, dB)` -> renderer OverlayContext `setAudioLevelDb` -> `VolumeMeter` component.

When `stopCapture()` is called, no more `onAudioData` callbacks fire. The renderer has partial protection: `OverlayContext` resets `audioLevelDb` to -60 when session status changes away from 'recording', and `StatusBar` only renders `VolumeMeter` when `sessionStatus === 'recording'`.

**Key gap**: In `pauseSession()`, `stopCapture()` is called at line 117, but `sendStatus('paused')` doesn't reach the renderer until line 126, AFTER the finalization await (up to 5 seconds). During this window, the renderer still sees `sessionStatus === 'recording'` and displays the meter with stale data. Additionally, for `handleDisconnect()` and `onAudioError()`, there's a brief window between `stopCapture()` and the status change IPC where the meter could show stale data.
