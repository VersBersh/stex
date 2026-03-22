# T4: Window Manager

## Summary

Create the Window Manager module that manages two Electron BrowserWindows: the overlay (transcription) window and the settings window, with all behaviors specified in the UI spec.

## Scope

- Create `src/main/window.ts`
- **Overlay window**:
  - Frameless (`frame: false`), always-on-top, skip-taskbar
  - Default size 600x300, minimum 400x200, resizable
  - Show/hide methods (not create/destroy)
  - Fade-in animation on show (~100ms), instant hide
  - Opacity: 100% when focused, 95% when blurred
  - Position persistence: save position/size to Settings Store on move/resize, restore on show
  - Validate saved position is on a connected display; reset to center of primary monitor if not
  - Load the overlay renderer HTML
- **Settings window**:
  - Standard window (not frameless), normal taskbar behavior
  - Open from tray menu or programmatically
  - Load the settings renderer HTML
- Export functions: `showOverlay()`, `hideOverlay()`, `toggleOverlay()`, `showSettings()`, `getOverlayWindow()`

## Acceptance Criteria

- Overlay window is frameless, always-on-top, and does not appear in taskbar
- Overlay window remembers and restores its position/size across show/hide cycles
- Position validation works when a monitor is disconnected
- Opacity changes on focus/blur
- Settings window opens as a separate, standard window
- Both windows load their respective renderer HTML

## References

- `spec/ui.md` — window dimensions, behavior, opacity, animations
- `spec/architecture.md` — Window Manager responsibilities
- `spec/features/system-tray.md` — window behavior on show/hide
