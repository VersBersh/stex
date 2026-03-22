# Hotkeys

## Global Hotkeys

These work from any application, even when stex is not focused.

| Hotkey | Action |
|--------|--------|
| `Ctrl+Shift+Space` | Toggle window visibility. When showing: starts recording. When hiding: finalizes pending speech, copies text to clipboard (if non-empty), then hides. |

The global hotkey is configurable in settings.

## In-App Hotkeys

These work when the stex window is focused.

| Hotkey | Action |
|--------|--------|
| `Escape` | Hide the window **without** copying to clipboard (quick dismiss). Unlike the global hotkey, Escape does not trigger finalization or clipboard copy. |
| `Ctrl+A` | Select all text |
| `Ctrl+C` | Copy selected text (or all text if nothing selected) |
| `Ctrl+V` | Paste text at cursor position |
| `Ctrl+Z` | Undo last edit |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+Backspace` | Delete previous word |
| `Ctrl+Shift+Backspace` | Clear all text (inline confirmation: status bar shows "Confirm clear?" for 3 seconds, press again to confirm) |

## Recording Control

| Hotkey | Action |
|--------|--------|
| `Ctrl+Shift+Space` (global) | Show window + start recording / Hide window + finalize + copy + hide |
| `Ctrl+P` | Pause / resume recording (toggle). When paused, mic stops, pending speech finalizes, window stays open for editing. |

Pause is also available via a button in the status bar.

### Session Flow

1. **Global hotkey** → window appears, recording starts, editor cleared or preserved per `onShow` setting
2. **Speak** → text appears in real time
3. **Pause** (button or `Ctrl+P`) → recording stops, pending speech finalizes, user edits freely
4. **Resume** (button or `Ctrl+P`) → recording resumes, new text appends at document tail
5. **Global hotkey** → window enters finalizing state, copies text to clipboard, then hides

### Future Consideration

- Per-app hotkey profiles
