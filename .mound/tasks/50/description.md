# UI: BrowserWindow backgroundColor per theme

## Summary
Set `BrowserWindow.backgroundColor` dynamically at window creation time based on the resolved theme (light/dark/system), to prevent a white flash when opening windows in dark mode.

Currently, the overlay and settings windows use `transparent: false` and default to a white background before CSS loads. When the user is in dark mode, this causes a brief white flash before the renderer CSS takes effect.

## Acceptance criteria
- `BrowserWindow.backgroundColor` is set to a theme-appropriate value (e.g. dark gray for dark mode, white for light mode) when creating overlay and settings windows.
- The resolved theme (accounting for "system" preference) is consulted before window creation.
- No visible white flash when opening windows in dark mode.
- Light mode continues to work without visual regression.

## References
- Discovered during T18 (Theming) implementation: `.mound/tasks/18/6-discovered-tasks.md`
- T18 established the CSS variable theming pattern: `.mound/tasks/18/description.md`
- Window creation logic: T4 (Window Manager)
