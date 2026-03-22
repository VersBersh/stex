# Plan

## Goal

Implement first-run experience: auto-open settings when no API key is configured, guard session start against missing API key, and leverage existing mic-permission/hotkey-conflict handling.

## Steps

### Step 1: Add `'no-api-key'` to ErrorInfo type

**File**: `src/shared/types.ts`

Add `'no-api-key'` to the `ErrorInfo.type` union:
```typescript
type: 'api-key' | 'rate-limit' | 'mic-denied' | 'mic-unavailable' | 'network' | 'no-api-key' | 'unknown';
```

This allows the session manager to send a typed error when no API key is configured, which the existing `ErrorBanner` component will render.

### Step 2: Add API key guard in `requestToggle()`

**File**: `src/main/session.ts`

In `requestToggle()`, before showing the overlay and starting a session, check if the API key is configured. If not, show the overlay with an error message instead of starting a session.

Modify the "not visible" branch of `requestToggle()`:
```typescript
} else {
    const settings = getSettings();
    if (!settings.sonioxApiKey) {
      showOverlay();
      sendError({
        type: 'no-api-key',
        message: 'Set up your API key in Settings to start transcribing',
        action: { label: 'Open Settings', action: 'open-settings' },
      });
      return;
    }
    clearError();
    showOverlay();
    startSession();
  }
```

Key details:
- When no API key: show overlay + send error (using existing `sendError` helper). Status stays `idle`. No session starts.
- When API key exists: call `clearError()` before starting session to clear any leftover "no-api-key" error from a previous show cycle (overlay React state persists across hide/show).
- The existing `handleErrorAction` in `OverlayContext.tsx` already dispatches `'open-settings'` action to `window.electronAPI.openSettings()`.

### Step 3: Extract `initApp()` and add first-run auto-open settings

**File**: `src/main/index.ts`

Extract the `app.whenReady()` callback into an exported `initApp()` function to make it testable. Add the first-run check at the end.

```typescript
import { app } from 'electron';
import { initWindowManager, showSettings } from './window';
import { registerSettingsIpc, getSettings } from './settings';
import { initTray } from './tray';
import { initHotkeyManager } from './hotkey';
import { registerAudioIpc } from './audio';
import { initThemeManager } from './theme';
import { initSessionManager } from './session';

export function initApp(): void {
  registerSettingsIpc();
  registerAudioIpc();
  initThemeManager();
  initWindowManager();
  initSessionManager();
  initTray();
  initHotkeyManager();

  // First-run: auto-open settings if no API key configured
  const settings = getSettings();
  if (!settings.sonioxApiKey) {
    showSettings();
  }
}

app.whenReady().then(initApp);

app.on('window-all-closed', () => {
  // Intentionally empty — prevent default quit behavior.
});
```

### Step 4: Write tests for API key guard in session

**File**: `src/main/session.test.ts`

Add test cases to the existing session test `describe` block, under a new `describe('API key guard')`:

1. **shows overlay and sends no-api-key error when API key is empty** — set `mockSettingsData.sonioxApiKey = ''`, call `requestToggle()`, verify `mockShowOverlay` called and error sent with type `'no-api-key'`.
2. **does not start session when API key is empty** — verify `mockSonioxInstance.connect` NOT called.
3. **sends open-settings action in no-api-key error** — verify the error includes `action: { label: 'Open Settings', action: 'open-settings' }`.
4. **clears error when starting session with valid API key** — set API key, call `requestToggle()`, verify `SESSION_ERROR` sent with null before session starts.
5. **second toggle hides overlay when shown without API key** — after no-API-key toggle, set overlay visible, toggle again → `hideOverlay` called.

### Step 5: Write tests for first-run auto-open

**File**: `src/main/first-run.test.ts`

Test the extracted `initApp()` function:

1. Mock all dependencies (`electron`, `./settings`, `./window`, `./tray`, `./hotkey`, `./audio`, `./theme`, `./session`).
2. **opens settings when API key is empty** — mock `getSettings` to return `sonioxApiKey: ''`, call `initApp()`, verify `showSettings` called.
3. **does not open settings when API key exists** — mock `getSettings` to return `sonioxApiKey: 'test-key'`, call `initApp()`, verify `showSettings` NOT called.
4. **still initializes all managers regardless of API key** — verify all init functions called in both cases.

## Risks / Open Questions

1. **ErrorInfo | null typing gap**: The `clearError()` function in session.ts sends `null` via `SESSION_ERROR`, and the renderer handles it. But the typed contracts (`ErrorInfo` not `ErrorInfo | null`) don't reflect this. This is a pre-existing issue not introduced by this task. Will note as a discovered task for cleanup.

2. **Spec ambiguity on "overlay does not appear"**: The spec says "overlay window does not appear until a valid API key is saved" but also says "pressing hotkey shows overlay with message". The plan follows the task description: overlay shows in error-only state when hotkey is pressed without API key. This matches the user's intent (they explicitly press the hotkey, they should see feedback).

3. **`window.electronAPI` bridge**: The overlay renderer uses `window.electronAPI.openSettings()` to handle the error action button. If this preload bridge isn't yet fully wired, the action button won't function. This is outside T19 scope — the bridge is referenced and used by existing overlay code.

4. **Microphone permission**: Already fully handled by the existing error infrastructure (`classifyAudioError` → `ErrorBanner` with "Grant access in Windows Settings" link). No new code needed.

5. **Hotkey conflict**: Already fully handled by `hotkey.ts` with system notifications. No new code needed.
