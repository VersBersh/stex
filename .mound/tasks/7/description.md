# T7: Overlay UI Shell

## Summary

Build the overlay window's React UI with a Lexical editor, custom frameless title bar, and status bar with action buttons. This is the visual shell — no transcription integration yet.

## Scope

- Create `src/renderer/overlay/index.html` and `src/renderer/overlay/index.tsx` (React entry)
- **TitleBar** (`src/renderer/overlay/components/TitleBar.tsx`):
  - Custom frameless title bar with drag region (`-webkit-app-region: drag`)
  - Single hide button (sends IPC to hide window)
- **Editor** (`src/renderer/overlay/editor/Editor.tsx`):
  - Lexical editor wrapper, basic rich-text editing surface
  - Scrollable, takes up most of the window
  - Standard keyboard shortcuts: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+Z, Ctrl+Shift+Z, Ctrl+Backspace
- **StatusBar** (`src/renderer/overlay/components/StatusBar.tsx`):
  - Left: mic icon + state text (hardcoded "Idle" for now)
  - Right: Pause/Resume button, Clear button (with inline "Confirm?" 3-second confirmation), Copy button
  - Escape key hides the window (IPC)
  - Ctrl+Shift+Backspace triggers clear with inline confirmation
  - Ctrl+P sends pause/resume IPC
- Layout matches `spec/ui.md` diagram

## Acceptance Criteria

- Overlay window renders with title bar, editor, and status bar
- Title bar is draggable, hide button works
- Lexical editor is functional for basic text editing (type, select, copy, paste, undo)
- Clear button shows "Confirm?" for 3 seconds before clearing
- Copy button copies editor text to clipboard
- Escape hides the window
- Layout matches the spec wireframe

## References

- `spec/ui.md` — layout, regions, status bar actions
- `spec/hotkeys.md` — in-app hotkeys
- `spec/architecture.md` — renderer component structure
