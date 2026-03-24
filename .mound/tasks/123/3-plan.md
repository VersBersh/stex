# Plan

## Goal

Add a real-time volume meter (dB bar) to the overlay during dictation, with a configurable silence threshold in settings, persisted as a user preference.

## Steps

### Step 1: Add `silenceThresholdDb` to `AppSettings` and defaults

**Files**: `src/shared/types.ts`, `src/main/settings.ts`

- Add `silenceThresholdDb: number` to the `AppSettings` interface in `types.ts`
- Add `silenceThresholdDb: -30` to `APP_SETTINGS_DEFAULTS` in `settings.ts`

### Step 2: Create `AudioLevelMonitor` module in main process

**Files**: `src/main/audio-level-monitor.ts` (new)

Pure function + rolling average state:
- `computeDbFromPcm16(chunk: Buffer): number` — compute RMS of PCM 16-bit LE samples, convert to dB via `20 * Math.log10(rms / 32768)`. Clamp to `-60` for silence (avoid -Infinity).
- `createAudioLevelMonitor(windowSize: number)` — returns `{ push(dB: number): number }` that maintains a rolling average over `windowSize` most recent values, returning the smoothed dB value on each push. Default `windowSize` of 5.

### Step 3: Add `AUDIO_LEVEL` IPC channel

**Files**: `src/shared/ipc.ts`

- Add `AUDIO_LEVEL: 'audio:level'` to `IpcChannels`

### Step 4: Wire audio level computation into soniox-lifecycle

**Files**: `src/main/soniox-lifecycle.ts`

- Import `computeDbFromPcm16`, `createAudioLevelMonitor` from `audio-level-monitor.ts`
- Add `onAudioLevel?: (dB: number) => void` to `SonioxLifecycleCallbacks` interface
- Create monitor instance in `connectSoniox`, null in `resetLifecycle`
- In `onAudioData(chunk)`, compute dB, push through monitor, call `callbacks.onAudioLevel?.(smoothedDb)`

### Step 5: Forward audio level from session manager to renderer

**Files**: `src/main/session.ts`

- In `createLifecycleCallbacks()`, add `onAudioLevel: (dB: number) => sendToRenderer(IpcChannels.AUDIO_LEVEL, dB)`

### Step 6: Add `onAudioLevel` to overlay preload bridge

**Files**: `src/preload/index.ts`, `src/shared/preload.d.ts`

- Add `onAudioLevel(callback: (dB: number) => void): () => void` to `ElectronAPI` interface in `preload.d.ts`
- Implement in `preload/index.ts`:
  ```ts
  onAudioLevel: (callback: (dB: number) => void) => {
    const handler = (_event: unknown, dB: number) => callback(dB);
    ipcRenderer.on(IpcChannels.AUDIO_LEVEL, handler);
    return () => { ipcRenderer.removeListener(IpcChannels.AUDIO_LEVEL, handler); };
  },
  ```

### Step 7: Add audio level state to OverlayContext

**Files**: `src/renderer/overlay/OverlayContext.tsx`

- Add `audioLevelDb: number` to `OverlayContextValue` interface (default `-60`)
- Add `const [audioLevelDb, setAudioLevelDb] = useState(-60);`
- Add `useEffect` subscribing to `window.api.onAudioLevel(setAudioLevelDb)`
- Pass `audioLevelDb` through the context provider value

### Step 8: Create `VolumeMeter` component for overlay

**Files**: `src/renderer/overlay/components/VolumeMeter.tsx` (new)

A small horizontal bar component:
- Props: `dB: number` (current smoothed level)
- Maps dB range [-60, 0] to bar width [0%, 100%]
- Color coding uses fixed dB bands (the threshold is for future VAD, not for overlay display): below -40dB = dim, above -20dB = green, between = gradient
- Renders as a `<div className="volume-meter">` with inner `<div className="volume-meter-fill">` whose width is `Math.max(0, Math.min(100, (dB + 60) / 60 * 100))%`

### Step 9: Add VolumeMeter to overlay StatusBar

**Files**: `src/renderer/overlay/components/StatusBar.tsx`

- Import `VolumeMeter`
- Get `audioLevelDb` from `useOverlay()`
- Render between mic icon and status text when `sessionStatus === 'recording'`:
  ```tsx
  {sessionStatus === 'recording' && <VolumeMeter dB={audioLevelDb} />}
  ```

### Step 10: Add overlay CSS for volume meter

**Files**: `src/renderer/overlay/overlay.css`

- `.volume-meter`: width 60px, height 8px, background `var(--bg-secondary)`, border-radius 4px, overflow hidden
- `.volume-meter-fill`: height 100%, transition `width 100ms ease-out`, background color via prop or CSS

### Step 11: Add silence threshold setting with visual scale to General page

**Files**: `src/renderer/settings/pages/General.tsx`, `src/renderer/settings/settings.css`

- Add a `setting-group` for "Silence Threshold":
  - Label with current dB value displayed
  - Range input: min=-60, max=-10, step=1, bound to `settings.silenceThresholdDb`
  - Below the slider: a visual dB scale bar (`.threshold-scale`) spanning -60 to 0 dB with a marker (`.threshold-marker`) positioned at the threshold percentage. This is a static bar (no live audio) that visually communicates where the threshold sits on the dB range.
  - Hint: "Audio below this level is treated as silence. Used for voice activity detection."

- CSS for the scale:
  - `.threshold-scale`: relative, height 12px, background gradient from dim to green, border-radius, max-width 300px
  - `.threshold-marker`: absolute, 2px wide vertical line at the threshold position

### Step 12: Update existing tests

**Files**: `src/main/settings.test.ts`, `src/preload/index.test.ts`

- Update `APP_SETTINGS_DEFAULTS` assertion in `settings.test.ts` to include `silenceThresholdDb: -30`
- Add `'onAudioLevel'` to the `listenerMethods` array in `index.test.ts` (line 134-145)

### Step 13: Write unit tests for AudioLevelMonitor

**Files**: `src/main/audio-level-monitor.test.ts` (new)

- Test `computeDbFromPcm16`: silence buffer -> -60dB, max-amplitude buffer -> ~0dB, known RMS -> correct dB
- Test `createAudioLevelMonitor`: rolling average smoothing, window size behavior

### Step 14: Update spec files

**Files**: `spec/architecture.md`, `spec/ui.md`

Apply changes from `2-spec-updates.md`:
- Add `audio:level` IPC channel row to architecture.md IPC Messages table
- Add `silenceThresholdDb` mention to architecture.md Settings Store
- Add Volume Meter subsection to ui.md Status Bar section
- Add Settings silence threshold UI description to ui.md

## Risks / Open Questions

1. **IPC frequency**: Audio chunks arrive ~10-20/s. Sending a number per chunk is lightweight. If performance becomes an issue, throttle to 10Hz. Acceptable for v1.

2. **Settings window has no live audio**: The settings page shows a static threshold scale, not a live meter. The task says "the same bar" but this is the closest practical equivalent since audio capture only runs during overlay dictation. A future "test microphone" feature could add live audio to settings.

3. **Sound event logging**: Marked as "stretch" in the task. NOT implemented in this plan — focused on core acceptance criteria.

4. **Overlay color coding vs threshold**: The overlay meter uses fixed dB bands for color (not the threshold). The threshold is for VAD consumption, not visual feedback during dictation. The settings page is where the threshold is visualized and configured.
