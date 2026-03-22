# UI Specification

## Window

### Dimensions

- **Default size**: 600px wide x 300px tall
- **Minimum size**: 400px x 200px
- **Resizable**: Yes, user can drag edges/corners
- **Position**: Remembers last position across sessions. Defaults to center of primary monitor on first launch. On show, validates that the saved position is within the bounds of a connected display — if not (e.g. external monitor was disconnected), resets to center of primary monitor.

### Behavior

- **Always on top**: Yes — the window floats above other applications so the user can see it while working
- **Frameless**: Minimal title bar with a drag region and a single hide button (hides to tray). No minimize button — the app is tray-resident
- **No taskbar entry**: The window does not appear in the Windows taskbar (it's a tray app)
- **Focus**: When shown, the window takes focus and the editor is immediately active (the user explicitly invoked it via hotkey, so stealing focus is expected)
- **Opacity**: Slight transparency (e.g. 95%) when unfocused to reinforce its overlay nature. Fully opaque when focused.
- **Focus loss**: When the user clicks on another application, the overlay remains visible on top (always-on-top) but becomes unfocused (95% opacity). The user can click back on the overlay to regain focus and edit. Transcription continues regardless of focus state.

## Layout

```
+------------------------------------------+
| [drag region]                       [X]  |
|                                          |
|  This is the transcribed text that the   |
|  user has been speaking. They can click   |
|  anywhere here to make corrections.      |
|                                          |
|  and this is the ghost text that is      |  <-- ghost text (styled differently)
|                                          |
+------------------------------------------+
| [mic icon] Recording...  [Pause] [Clear] [Copy]|
+------------------------------------------+
```

### Regions

1. **Title bar** — minimal drag handle + single hide button (hides window to tray)
2. **Editor area** — scrollable Lexical editor, takes up most of the window
3. **Status bar** — recording state indicator, action buttons

## Text Styling

### Committed Text (Final)

- Standard text appearance — dark text on light background
- Fully editable, normal cursor behavior
- No special decoration

### User-Edited Text

- Same appearance as committed text — edits blend in seamlessly
- No visual distinction from original transcription (the user's corrections should look like the "real" text)

### Ghost Text (Non-Final)

- **Muted color** — e.g. `#999` on light theme, `#666` on dark theme
- **Italic** — to further distinguish from committed text
- **Not selectable / not editable** — cursor cannot enter the ghost text region
- **Updates in place** — replaces itself smoothly, no flicker

**Cursor boundary behavior**:
- Arrow Right at the end of committed text: cursor stays at end of committed text, does not enter ghost text
- Mouse click within ghost text: cursor snaps to end of committed text
- Mouse drag selection that extends into ghost text: selection stops at end of committed text
- Backspace at the boundary (cursor at end of committed text): deletes the last committed character (normal behavior)

## Status Bar

- **Left**: Microphone icon + state text ("Recording...", "Paused", "Connecting...")
- **Right**: Action buttons
  - **Pause / Resume** — toggle recording on/off within a session. Icon changes to indicate state (mic on / mic off)
  - **Clear** — clears the editor. If text is present, the button changes to "Confirm?" for 3 seconds (inline confirmation). Clicking again within 3 seconds clears; otherwise reverts to "Clear". No modal dialog.
  - **Copy** — copies all text to clipboard

## Error States

When an error occurs (invalid API key, network failure, quota exceeded):

- A **compact error banner** appears between the editor and the status bar
- The banner shows the error message and, where applicable, an action button (e.g. "Open Settings" for API key issues)
- The banner has a dismiss button (X) to clear it
- The status bar state text updates to reflect the error (e.g. "Error", "Disconnected")
- Errors are not auto-dismissed — the user must explicitly dismiss them or the error condition must be resolved

## Themes

- Support light and dark mode
- Follow system theme by default
- Minimal color palette — this is a utility, not a feature-rich app

## Animations

- Window show: fade in (100ms) — fast enough to feel instant, smooth enough to not be jarring
- Window hide: instant (no animation — hiding should feel like dismissing)
- Ghost text updates: crossfade or instant replacement, no layout shift
