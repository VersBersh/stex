# T18: Theming — Discovered Tasks

1. **UI: BrowserWindow backgroundColor per theme**
   - Set `BrowserWindow.backgroundColor` dynamically at window creation time based on the resolved theme, to prevent a white flash when opening windows in dark mode.
   - Discovered because: the overlay and settings windows use `transparent: false` and default to white background before CSS loads.

2. **UI: Error banner theming**
   - When the error banner component is implemented (per spec/ui.md), it should use the CSS variable theming pattern established here.
   - Discovered because: the error banner is specced but not yet built; its colors will need dark mode variants.
