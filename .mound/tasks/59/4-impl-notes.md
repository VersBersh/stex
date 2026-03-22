# Implementation Notes

## Files modified

| File | Change |
|------|--------|
| `src/main/window.ts` | Removed `toggleOverlay()` export (lines 248-254) |
| `src/main/window-visibility.test.ts` | Removed `toggleOverlay` import and its `describe` block (2 tests) |
| `spec/architecture.md` | Updated Hotkey Manager description in table and ASCII diagram to reflect Session Manager routing |

## Deviations from plan

Added fix for ASCII diagram in `spec/architecture.md` (lines 24-25) — changed "Dispatch show/hide" to "Toggle via Session Mgr". Flagged by code review as a minor consistency issue with the table fix already in the plan.

## New tasks or follow-up work

None discovered. The mock variable naming (`mockToggleOverlay` in `hotkey.test.ts` and `tray.test.ts`) is noted in the plan as intentionally out of scope.
