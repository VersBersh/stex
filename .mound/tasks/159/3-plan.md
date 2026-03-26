# Plan

## Goal

Add Electron session permission handlers to auto-grant microphone access, enabling `enumerateDevices()` to return device labels without a `getUserMedia()` bootstrap, and surface a user-visible warning when mic permission is denied at the OS level.

## Steps

### Step 1: Create `src/main/permissions.ts`

New module that configures Electron's session permission APIs on the default session.

```typescript
import { session } from 'electron';
import { debug } from './logger';

export function initPermissions(): void {
  const ses = session.defaultSession;

  // Grant all permission checks — both windows load only our own local content.
  // This ensures enumerateDevices() returns device labels (media permission check)
  // and navigator.clipboard.writeText() continues to work (clipboard-sanitized-write).
  ses.setPermissionCheckHandler((_webContents, permission) => {
    debug('Permission check: %s → granted', permission);
    return true;
  });

  // Auto-approve media permission requests so getUserMedia() never prompts.
  // Deny other permission requests since we don't expect them.
  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      debug('Granting media permission request');
      callback(true);
      return;
    }
    debug('Denying permission request: %s', permission);
    callback(false);
  });
}
```

Rationale for allowing all permission checks: both the overlay and settings windows load only our own local files via `loadFile()`. No external web content is loaded. The overlay uses `navigator.clipboard.writeText()` which requires `clipboard-sanitized-write` permission check, so we cannot blanket-deny non-media checks.

Permission requests are more targeted: only `media` is auto-approved. Other request types are denied as an extra safety measure.

### Step 2: Wire `initPermissions()` into `src/main/index.ts`

Add `import { initPermissions } from './permissions';` and call `initPermissions()` **before** `initWindowManager()` so permission handlers are in place before any BrowserWindow is created.

Insert between `initThemeManager()` and `initWindowManager()`:
```typescript
initPermissions();
debug('initApp: permissions initialized (%.0fms)', performance.now() - t0);
```

### Step 3: Update `SettingsAPI` type in `src/shared/preload.d.ts`

Add the `AudioDeviceResult` type and update the `getAudioDevices` signature:

```typescript
export interface AudioDeviceResult {
  devices: string[];
  permissionDenied: boolean;
}

export interface SettingsAPI {
  // ...existing methods...
  getAudioDevices(): Promise<AudioDeviceResult>;
  // ...
}
```

### Step 4: Simplify `getAudioDevices` in `src/preload/settings-preload.ts`

Remove the throwaway `getUserMedia()` bootstrap call. With `setPermissionCheckHandler` returning `true` for `media`, `enumerateDevices()` should return labels directly.

Detect the permission-denied case: if audioinput devices exist but none have labels, it indicates OS-level mic permission is blocked.

New implementation:
```typescript
getAudioDevices: async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === 'audioinput');
    const labeled = audioInputs.filter(d => d.label);
    return {
      devices: labeled.map(d => d.label),
      permissionDenied: audioInputs.length > 0 && labeled.length === 0,
    };
  } catch {
    return { devices: [], permissionDenied: false };
  }
},
```

Also update the import of the `SettingsAPI` type to include `AudioDeviceResult` if needed for the type annotation.

### Step 5: Update consumer in `src/renderer/settings/index.tsx`

Change state handling to extract devices and permission-denied flag from the new result shape:

```typescript
const [audioDevices, setAudioDevices] = useState<string[]>([]);
const [micPermissionDenied, setMicPermissionDenied] = useState(false);
```

Update both device-fetching callsites (initial load and focus handler):
```typescript
window.settingsApi.getAudioDevices().then((result) => {
  setAudioDevices(result.devices);
  setMicPermissionDenied(result.permissionDenied);
});
```

Pass `micPermissionDenied` to the `General` component as a prop.

### Step 6: Show warning in `src/renderer/settings/pages/General.tsx`

Add a `micPermissionDenied: boolean` prop to the `Props` interface. Render a warning message below the audio device dropdown when `true`:

```tsx
{micPermissionDenied && (
  <p className="hint warning">
    Microphone permission was denied. Check your system privacy settings to allow microphone access.
  </p>
)}
```

### Step 7: Add `.warning` CSS in `src/renderer/settings/settings.css`

Add CSS variables for warning color in both light and dark themes, and a `.hint.warning` rule:

Light theme:
```css
--warning-color: #b35900;
```

Dark theme:
```css
--warning-color: #f0ad4e;
```

Rule:
```css
.setting-group .hint.warning {
  color: var(--warning-color);
}
```

## Risks / Open Questions

1. **`setPermissionCheckHandler` may not unlock labels**: Chromium's internal label gating in `enumerateDevices()` may require an actual `getUserMedia()` grant rather than just a permission check returning `true`. If so, the `permissionDenied` heuristic will trigger and warn the user. A fallback `getUserMedia()` call could be reinstated, but it would be auto-granted by `setPermissionRequestHandler` (no prompt, no fragility). This is a behavioral difference from the current bootstrap approach and should be validated at runtime.

2. **All permission checks are allowed**: This is safe because both windows load only local files via `loadFile()`. If external content is ever loaded in the future, this policy should be revisited to restrict permissions by origin.

3. **OS-level permission denial detection heuristic**: The "devices exist but labels are empty" check may produce false positives for virtual audio devices with empty labels. This is an acceptable trade-off — a false positive shows a non-harmful warning.
