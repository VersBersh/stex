# Plan (Revised)

## Goal

Replace the naudiodon/PortAudio audio capture in the main process with Chromium's `getUserMedia` + AudioWorklet in the overlay renderer process, sending PCM chunks to main via IPC, to fix Bluetooth headset compatibility.

## Steps

### Step 1: Add new IPC channel constants

**File:** `src/shared/ipc.ts`

Add four new channel constants:
```ts
AUDIO_START_CAPTURE: 'audio:start-capture',  // Main → Renderer
AUDIO_STOP_CAPTURE: 'audio:stop-capture',     // Main → Renderer
AUDIO_CHUNK: 'audio:chunk',                   // Renderer → Main
AUDIO_CAPTURE_ERROR: 'audio:capture-error',   // Renderer → Main
```

### Step 2: Create renderer-side audio capture module

**New file:** `src/renderer/overlay/audio-capture.ts`

This module manages `getUserMedia` + AudioWorklet in the overlay renderer.

The AudioWorklet processor source is embedded as an inline string and loaded via blob URL (avoids webpack/static-asset complications).

Processor behavior:
- Extends `AudioWorkletProcessor`
- In `process()`, receives Float32 input data (128 frames per call at 16kHz = 8ms)
- Accumulates frames into a batch buffer (target ~100ms = 1600 samples)
- When batch is full, converts Float32 [-1,1] to Int16 [-32768,32767] and posts the Int16Array buffer via `this.port.postMessage(buffer, [buffer])` (transferable)
- Returns `true` to keep processing

Module exports:
```ts
export async function startAudioCapture(
  deviceName: string | null,
  onChunk: (pcm16Buffer: ArrayBuffer) => void,
  onError: (err: Error) => void,
): Promise<void>

export function stopAudioCapture(): void

export async function enumerateAudioInputDevices(): Promise<string[]>
```

**`startAudioCapture()`**:
1. Call `navigator.mediaDevices.enumerateDevices()` to find the device matching `deviceName` by label. If `deviceName` is null, use default (no deviceId constraint).
2. Call `navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: resolvedId }, channelCount: 1 } })`.
3. Create `AudioContext({ sampleRate: 16000 })` — Chromium resamples from hardware rate to 16kHz.
4. Load worklet via blob URL: `const blob = new Blob([PROCESSOR_SOURCE], { type: 'application/javascript' }); const url = URL.createObjectURL(blob); await ctx.audioWorklet.addModule(url); URL.revokeObjectURL(url);`
5. Connect `MediaStreamAudioSourceNode` → `AudioWorkletNode`.
6. Listen for messages from the worklet via `node.port.onmessage` — each contains an `ArrayBuffer` of Int16 PCM.
7. Call `onChunk(buffer)` for each received chunk.
8. Store all resources (AudioContext, MediaStream, AudioWorkletNode) in module-level state for cleanup.

**`stopAudioCapture()`**:
1. Stop all tracks on the MediaStream.
2. Disconnect the AudioWorkletNode.
3. Close the AudioContext.
4. Clear stored references.
5. No-op if not currently capturing.

**`enumerateAudioInputDevices()`**:
1. To ensure labels are populated, attempt a temporary `getUserMedia({ audio: true })` call, stop its tracks immediately, then enumerate.
2. Call `navigator.mediaDevices.enumerateDevices()`.
3. Filter to `kind === 'audioinput'`, exclude entries with empty labels.
4. Return array of `device.label` strings.

### Step 3: Add audio capture IPC to overlay preload bridge

**File:** `src/preload/index.ts`

Add new methods to the `api` object:
```ts
// Listen (Main → Renderer)
onAudioStartCapture: (callback: (deviceName: string | null) => void) => {
  const handler = (_event: unknown, deviceName: string | null) => callback(deviceName);
  ipcRenderer.on(IpcChannels.AUDIO_START_CAPTURE, handler);
  return () => { ipcRenderer.removeListener(IpcChannels.AUDIO_START_CAPTURE, handler); };
},
onAudioStopCapture: (callback: () => void) => {
  const handler = () => callback();
  ipcRenderer.on(IpcChannels.AUDIO_STOP_CAPTURE, handler);
  return () => { ipcRenderer.removeListener(IpcChannels.AUDIO_STOP_CAPTURE, handler); };
},

// Send (Renderer → Main)
sendAudioChunk: (buffer: ArrayBuffer) => ipcRenderer.send(IpcChannels.AUDIO_CHUNK, Buffer.from(buffer)),
sendAudioCaptureError: (message: string) => ipcRenderer.send(IpcChannels.AUDIO_CAPTURE_ERROR, message),
```

**File:** `src/shared/preload.d.ts`

Add to `ElectronAPI`:
```ts
onAudioStartCapture(callback: (deviceName: string | null) => void): () => void;
onAudioStopCapture(callback: () => void): () => void;
sendAudioChunk(buffer: ArrayBuffer): void;
sendAudioCaptureError(message: string): void;
```

### Step 4: Update settings preload for renderer-side device enumeration

**File:** `src/preload/settings-preload.ts`

Change `getAudioDevices` from IPC-based to direct `navigator.mediaDevices` enumeration:
```ts
getAudioDevices: async () => {
  try {
    // Ensure labels are populated by requesting temporary mic access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
  } catch {
    // Permission denied — return empty list
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter(d => d.kind === 'audioinput' && d.label)
      .map(d => d.label);
  } catch {
    return [];
  }
},
```

This preserves the `SettingsAPI.getAudioDevices(): Promise<string[]>` contract in `preload.d.ts`. The settings renderer (`settings/index.tsx`) continues calling `window.settingsApi.getAudioDevices()` with no changes needed there.

### Step 5: Wire up audio capture in overlay renderer

**File:** `src/renderer/overlay/OverlayContext.tsx`

Add a `useEffect` that subscribes to start/stop capture IPC commands:

```ts
import { startAudioCapture, stopAudioCapture } from './audio-capture';

// In OverlayProvider:
useEffect(() => {
  const unsubStart = window.api.onAudioStartCapture(async (deviceName) => {
    try {
      await startAudioCapture(
        deviceName,
        (buffer) => window.api.sendAudioChunk(buffer),
        (err) => window.api.sendAudioCaptureError(err.message),
      );
    } catch (err) {
      window.api.sendAudioCaptureError((err as Error).message);
    }
  });
  const unsubStop = window.api.onAudioStopCapture(() => {
    stopAudioCapture();
  });
  return () => { unsubStart(); unsubStop(); };
}, []);
```

### Step 6: Rewrite `src/main/audio.ts`

Replace the entire naudiodon-based implementation. Key design change from review: the error handler in `registerAudioIpc` must send `AUDIO_STOP_CAPTURE` to the renderer **before** clearing state, so the renderer cleans up its resources.

```ts
import { ipcMain } from 'electron';
import { getSettings } from './settings';
import { IpcChannels } from '../shared/ipc';
import { sendToRenderer } from './renderer-send';
import { info, debug } from './logger';

let capturing = false;
let dataHandler: ((chunk: Buffer) => void) | null = null;
let errorHandler: ((error: Error) => void) | null = null;

export function startCapture(
  onData: (chunk: Buffer) => void,
  onError: (error: Error) => void,
): void {
  if (capturing) {
    throw new Error('Audio capture is already active');
  }

  const { audioInputDevice } = getSettings();
  info('Audio capture starting (device: %s)', audioInputDevice ?? 'default');

  capturing = true;
  dataHandler = onData;
  errorHandler = onError;

  // Tell the renderer to start getUserMedia capture
  sendToRenderer(IpcChannels.AUDIO_START_CAPTURE, audioInputDevice);
}

export function stopCapture(): void {
  if (!capturing) return;
  debug('Audio capture stopped');

  capturing = false;
  dataHandler = null;
  errorHandler = null;

  // Tell the renderer to stop capture
  sendToRenderer(IpcChannels.AUDIO_STOP_CAPTURE);
}

export function registerAudioIpc(): void {
  // Receive PCM audio chunks from the renderer
  ipcMain.on(IpcChannels.AUDIO_CHUNK, (_event, chunk: Buffer) => {
    if (capturing && dataHandler) {
      dataHandler(chunk);
    }
  });

  // Receive capture errors from the renderer
  ipcMain.on(IpcChannels.AUDIO_CAPTURE_ERROR, (_event, message: string) => {
    if (capturing && errorHandler) {
      // IMPORTANT: Send stop command to renderer FIRST so it cleans up
      // MediaStream/AudioContext/worklet resources. Then clear local state
      // and invoke the error callback.
      sendToRenderer(IpcChannels.AUDIO_STOP_CAPTURE);

      const handler = errorHandler;
      capturing = false;
      dataHandler = null;
      errorHandler = null;
      handler(new Error(message));
    }
  });
}
```

Note: `listDevices()` is removed — device enumeration is now renderer-side. The `AUDIO_GET_DEVICES` IPC handler is removed from `registerAudioIpc()` since the settings preload now handles it directly.

### Step 7: Normalize renderer-side audio errors for classification

**File:** `src/renderer/overlay/audio-capture.ts` (in `startAudioCapture`)

Before sending errors via IPC, normalize browser DOMException names to messages the existing classifier in `error-classification.ts` can parse:
```ts
function normalizeAudioError(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
        return 'Microphone access denied';
      case 'NotFoundError':
        return 'Audio device not found';
      case 'NotReadableError':
        return 'Audio device unavailable';
      default:
        return err.message;
    }
  }
  return (err as Error).message ?? String(err);
}
```

This ensures `classifyAudioError()` in main process correctly maps browser errors to `mic-denied`, `mic-unavailable`, etc. without needing to change the classifier itself.

### Step 8: Remove naudiodon dependency

**File:** `package.json`
- Remove `"naudiodon": "^2.3.6"` from dependencies
- Remove `"node-gyp"` override (only needed for naudiodon)

**File:** `webpack.main.config.js`
- Remove `naudiodon: 'commonjs naudiodon'` from externals

**File:** Run `npm install` to regenerate `package-lock.json` without naudiodon.

### Step 9: Remove `AudioDevice` type

**File:** `src/shared/types.ts`

Remove the `AudioDevice` interface (was only used by naudiodon-based `audio.ts`). Verify no other imports reference it.

### Step 10: Remove main-side `AUDIO_GET_DEVICES` handler

Since device enumeration is now handled directly in the settings preload (Step 4), remove:

**File:** `src/main/audio.ts` — The `AUDIO_GET_DEVICES` handler is already removed in Step 6 (the new `registerAudioIpc()` doesn't register it).

**File:** `src/shared/ipc.ts` — Keep the `AUDIO_GET_DEVICES` constant for now since it may be referenced. Actually, check references — if only the old `audio.ts` and `settings-preload.ts` used it, and settings-preload no longer uses it, remove the constant.

### Step 11: Update tests

**File:** `src/main/audio.test.ts` — **Complete rewrite**

Replace naudiodon-based tests with tests for the new IPC-based audio module:
- `startCapture` sets capturing state and calls `sendToRenderer` with `AUDIO_START_CAPTURE` and device name
- `stopCapture` clears state and calls `sendToRenderer` with `AUDIO_STOP_CAPTURE`
- `registerAudioIpc` registers `ipcMain.on` handlers for `AUDIO_CHUNK` and `AUDIO_CAPTURE_ERROR`
- Receiving an `AUDIO_CHUNK` IPC calls the `onData` callback with a Buffer
- Receiving an `AUDIO_CAPTURE_ERROR` IPC: sends `AUDIO_STOP_CAPTURE` to renderer, then calls `onError` callback
- After error handling, `capturing` is false (no leak)
- `startCapture` throws if already capturing
- `stopCapture` is a no-op when not capturing

**File:** `src/preload/index.test.ts` — Add tests for new preload methods:
- `onAudioStartCapture` registers listener via `ipcRenderer.on`
- `onAudioStopCapture` registers listener via `ipcRenderer.on`
- `sendAudioChunk` calls `ipcRenderer.send` with `audio:chunk`
- `sendAudioCaptureError` calls `ipcRenderer.send` with `audio:capture-error`
- Unsubscribe functions work correctly

**File:** `src/preload/settings-preload.test.ts` — Update `getAudioDevices` tests:
- Remove the test that checks `ipcRenderer.invoke` is called with `AUDIO_GET_DEVICES`
- Add a test that `getAudioDevices` is a function and returns a promise (the actual browser API calls can't be tested in this mock context, but we verify the function exists)

**File:** `src/main/soniox-lifecycle.test.ts` — Mock shape unchanged (`startCapture`/`stopCapture` already mocked as simple functions). No changes needed.

**File:** `src/main/session.test.ts` — Same, mock shape unchanged.

**File:** `src/main/first-run.test.ts` — Already mocks `registerAudioIpc` as a simple function. No changes needed.

### Step 12: Update spec

**File:** `spec/architecture.md`

Apply all spec changes (see revised `2-spec-updates.md`):
- Split Audio Capture into two: main-process relay (receives chunks from renderer, forwards to Soniox) + renderer-process capture (getUserMedia + AudioWorklet)
- Add Audio Capture to the Renderer (Overlay) responsibilities table
- Update Data Flow diagram
- Update IPC Messages table (add new channels, update `audio:get-devices` description)
- Update Settings UI responsibility to note renderer-side device enumeration
- Update Technology Stack table
- Update File Structure section

## Risks / Open Questions

1. **AudioContext sampleRate**: Creating `AudioContext({ sampleRate: 16000 })` makes Chromium resample from hardware rate to 16kHz. Well-supported in modern Chromium/Electron 33+.

2. **IPC overhead**: ~3200 bytes every ~100ms is negligible for Electron IPC.

3. **Device label permission bootstrap**: The `enumerateAudioInputDevices()` function and the settings preload both do a temporary `getUserMedia({ audio: true })` call to ensure labels are populated. This triggers the OS mic permission prompt if not already granted. In Electron, this should auto-grant. If the user has disabled mic in Windows Settings, the permission request will fail gracefully and return an empty device list.

4. **"Test Microphone" feature**: Does not exist in the current codebase. If added by another task, it will use the same `startCapture`/`stopCapture` API.

5. **Device name matching post-migration**: Browser `enumerateDevices()` labels may differ slightly from PortAudio names. Existing saved device preferences may not match — user can re-select.

6. **naudiodon removal**: Removes native PortAudio dependency, simplifying the build (no node-gyp).
