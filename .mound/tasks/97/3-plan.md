# Plan

## Goal

Complete the audio input device selector by wiring up the stubbed IPC handler to return actual device names and adding device-list refresh on window focus.

## Steps

### 1. Fix IPC handler in `src/main/audio.ts`

Change `registerAudioIpc()` (line 86-90) to return actual device names from `listDevices()` instead of an empty array.

```typescript
export function registerAudioIpc(): void {
  ipcMain.handle(IpcChannels.AUDIO_GET_DEVICES, () => {
    return listDevices().map(d => d.name);
  });
}
```

This maps `AudioDevice[]` to `string[]` matching the `SettingsAPI.getAudioDevices(): Promise<string[]>` contract in `src/shared/preload.d.ts`.

### 2. Update test in `src/main/audio.test.ts`

Update the `registerAudioIpc` describe block (line 227-244). The test at line 237 currently asserts the handler returns an empty array. Change it to assert the handler returns the names of the 3 input devices from the mock data (Built-in Microphone, USB Headset, Virtual Cable — the 3 devices with `maxInputChannels > 0`).

### 3. Add device-list refresh in `src/renderer/settings/index.tsx`

Add a `focus` event listener on the window so the device list re-fetches when the settings window regains focus. This handles the acceptance criterion "The device list refreshes if devices are added/removed" — when a user plugs in a new mic and alt-tabs back to settings, the list updates.

In the existing `useEffect` block (line 33-42), add a focus handler and update the cleanup:

```typescript
useEffect(() => {
  window.settingsApi.getSettings().then(setSettings);
  window.settingsApi.getAudioDevices().then(setAudioDevices);

  const unsubscribe = window.settingsApi.onSettingsUpdated((updated) => {
    setSettings(updated);
  });

  const handleFocus = () => {
    window.settingsApi.getAudioDevices().then(setAudioDevices);
  };
  window.addEventListener('focus', handleFocus);

  return () => {
    unsubscribe();
    window.removeEventListener('focus', handleFocus);
  };
}, []);
```

### 4. Update spec IPC table in `spec/architecture.md`

Add a row to the IPC Messages table (after `settings:set` at ~line 132) documenting `audio:get-devices`:

```
| Renderer → Main | `audio:get-devices` | — | Request list of available audio input device names |
```

## Risks / Open Questions

- **No automatic refresh while settings window stays focused:** If a device is plugged in while the settings window is in the foreground without losing focus, the list won't update until the user switches away and back. This is acceptable UX — polling would add complexity with little benefit. The plan reviewer flagged this; however, focus-based refresh is the pragmatic approach and matches how other desktop apps handle device enumeration (e.g., Discord, OBS).
- **Device enumeration performance:** `portAudio.getDevices()` is synchronous and should be fast, but if it ever blocks, the IPC handler would freeze the main process briefly. This is unlikely and matches how the existing `startCapture()` already calls `listDevices()` synchronously.
- **Existing acceptance criteria coverage:**
  - Dropdown UI: already exists in `General.tsx`
  - Selected device used for transcription: already works via `startCapture()` reading `audioInputDevice` from settings
  - Persistence: already works via electron-store (`audioInputDevice: string | null`)
  - Device list refresh: addressed by Step 3
