# Implementation Notes

## Files created or modified

- `src/main/tray.ts` — Replaced stub with full tray manager: `initTray()`, `destroyTray()`, embedded base64 PNG icon, context menu with Show/Hide, Settings, Quit
- `src/main/index.ts` — Added `initTray()` call after `initWindowManager()`, updated comment
- `src/main/tray.test.ts` — New test file with 12 tests covering init, menu actions, destroy, and re-init

## Deviations from plan

None.

## New tasks or follow-up work

- **Design: Replace placeholder tray icon** — The current tray icon is a minimal grey square PNG embedded as base64. A proper branded icon (likely .ico for optimal Windows rendering) should be designed and substituted.
