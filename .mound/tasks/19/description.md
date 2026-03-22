# T19: First-Run Experience

## Summary

Implement the first-run flow that guides new users through API key setup, microphone permission, and handles hotkey registration conflicts.

## Scope

- **First launch detection**: no `settings.json` exists or `sonioxApiKey` is empty
- **On first launch**:
  1. Settings window opens automatically to the API key configuration page
  2. Overlay window does not appear until a valid API key is saved
- **Hotkey pressed without API key**:
  - Overlay shows a single-line message: "Set up your API key in Settings to start transcribing"
  - Message includes a clickable link to open the settings window
- **Microphone permission**:
  - On first session start, request microphone access
  - If denied: status bar shows "Microphone access denied", error banner with "Grant access in Windows Settings" link
  - No recording starts until permission is granted
- **Hotkey registration conflict**:
  - If `globalShortcut.register` fails (another app has the hotkey), show a system notification
  - Notification directs user to Settings to choose a different hotkey
- Once API key is saved and mic permission granted, the app behaves normally

## Acceptance Criteria

- First launch opens settings window to API key page
- Hotkey without API key shows setup prompt in overlay
- Mic permission denial shows actionable error
- Hotkey conflict shows system notification
- After setup is complete, normal operation begins

## References

- `spec/features/system-tray.md` — first-run experience, microphone permission, hotkey failure
