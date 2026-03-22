# Feature: System Tray and Global Hotkey

## Summary

The app runs persistently in the system tray and toggles its window via a global hotkey, ensuring instant activation without startup delay.

## Behavior

### Startup

- App launches on Windows login (optional, configurable)
- Main window is created but hidden
- Lexical editor is initialized in the background
- App icon appears in the system tray

### First-Run Experience

On first launch (no API key available — see [Stored vs Effective Settings](../models.md#stored-vs-effective-settings)):

1. The **settings window** opens automatically to the API key configuration page
2. The overlay window does not appear until a valid API key is saved
3. If the user presses the global hotkey without an API key available, the overlay shows a single-line message: "Set up your API key in Settings to start transcribing" with a clickable link to open the settings window
4. Once a valid API key is saved, the app behaves normally

### Microphone Permission

On first attempt to start a session, the app requests microphone access. If the user denies permission:
- The status bar shows "Microphone access denied"
- An error banner appears with a link: "Grant access in Windows Settings"
- No recording starts until permission is granted

### Global Hotkey

- Default hotkey: `Ctrl+Shift+Space` (configurable in settings)
- **Press to show**: Window appears at its last position, microphone starts capturing, transcription begins
- **Press to hide**: Transcription finalizes, text copied to clipboard (if non-empty), window hides
- **Registration failure**: If `globalShortcut.register` fails (another app has the hotkey), show a system notification telling the user the hotkey is in use and directing them to Settings to choose a different one

### System Tray Menu

Right-click the tray icon to access:

- **Show/Hide** — toggle the overlay window
- **Settings** — open the settings window (separate window for API key, hotkey config, preferences, history)
- **Quit** — exit the application entirely

### Window Behavior on Show

- Window appears at its last-used position and size
- The `onShow` setting determines editor state:
  - **`"fresh"`** (default): Clear the editor, start with a blank document
  - **`"append"`**: Keep previous text, place cursor at the end, new transcription appends after existing content
- Focus is given to the editor immediately
- Recording indicator shows that the mic is active

### Window Behavior on Hide

- Window is hidden (not closed or destroyed)
- Editor state is preserved in memory (available if `onShow` is `"append"`)
- WebSocket connection is closed (see [api.md](../api.md) for lifecycle details)
- Audio capture stops

## Acceptance Criteria

- Window remembers its last position and size
- Tray icon is always visible when the app is running
- Hotkey works from any application / context

### Performance Goals

- Window appears in under 50ms after hotkey press (aspirational — measured from hotkey event to window visible)
