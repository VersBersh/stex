# Plan

## Goal

Reset the volume meter to zero when audio capture stops (pause, stop, disconnect, error) by sending MIN_DB via the audio level callback/IPC at each stop point.

## Steps

### Step 1: Export `MIN_DB` from `audio-level-monitor.ts`

**File**: `src/main/audio-level-monitor.ts`

Change `const MIN_DB = -60;` to `export const MIN_DB = -60;` so it can be imported by `soniox-lifecycle.ts` and `session.ts`.

### Step 2: Send audio level reset in `soniox-lifecycle.ts`

**File**: `src/main/soniox-lifecycle.ts`

Import `MIN_DB` from `./audio-level-monitor`.

Add `activeCallbacks?.onAudioLevel?.(MIN_DB);` after `stopCapture()` in:
- `handleDisconnect()` (after line 77)
- `onAudioError()` (after line 104)
- `connectSoniox()` `onError` callback (after line 161)

### Step 3: Send audio level reset in `session.ts`

**File**: `src/main/session.ts`

Import `MIN_DB` from `./audio-level-monitor`.

Add `sendToRenderer(IpcChannels.AUDIO_LEVEL, MIN_DB);` after `stopCapture()` in:
- `pauseSession()` (after line 117)
- `stopSession()` (after line 154)
- `requestQuickDismiss()` (after line 215)

### Step 4: Add tests

**Files**: `src/main/soniox-lifecycle.test.ts`, `src/main/session.test.ts`

Add tests verifying that `AUDIO_LEVEL` IPC / `onAudioLevel` callback is called with MIN_DB (-60) after `stopCapture()` in each of these flows:
- In `soniox-lifecycle.test.ts`: disconnect, audio error
- In `session.test.ts`: pause, stop, quick dismiss

Follow existing test patterns in both files.

## Risks / Open Questions

- **Auto-decay removed**: The task description suggests considering auto-decay in the renderer. This was evaluated and rejected because the explicit resets in Steps 2-3 cover all `stopCapture()` call sites, and a renderer-side timer could cause false zero levels during transient IPC delays while recording is still active.
- **CSS transition already exists**: `overlay.css` already has `transition: width 100ms ease-out` on `.volume-meter-fill`, so the reset will animate smoothly without any renderer changes.
