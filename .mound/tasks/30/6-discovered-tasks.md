# Discovered Tasks for Task 30

1. **WIN: Consider removing or deprecating `toggleOverlay()`**
   - `toggleOverlay()` in `window.ts` calls `showOverlay()`/`hideOverlay()` directly, bypassing Session Manager lifecycle. It is not used by any production code — hotkey and tray both use `requestToggle()` from session.ts.
   - Discovered when reviewing all code paths that show/hide the overlay. The function is exported and tested but is a raw visibility primitive with no session awareness.
