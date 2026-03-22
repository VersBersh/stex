# Read initial overlay window geometry from persisted settings

## Summary
`createOverlayWindow()` in `window.ts` hard-codes `width: 600, height: 300`. It should instead read from `getSettings().windowSize` to use persisted values, eliminating duplication with `APP_SETTINGS_DEFAULTS`. This ensures the overlay opens at the size the user last used.

## Acceptance criteria
- `createOverlayWindow()` reads `width` and `height` from the settings store (`getSettings().windowSize` or equivalent).
- Falls back to `APP_SETTINGS_DEFAULTS` values if no persisted size exists.
- The hard-coded `600x300` values are removed from `window.ts`.
- Unit test verifies window is created with persisted dimensions when available.

## References
- T4 (task 4): Window Manager — contains `createOverlayWindow()`
- T3 (task 3): Settings Store — provides `getSettings()` and `APP_SETTINGS_DEFAULTS`
- Source: `.mound/tasks/3/6-discovered-tasks.md` item 2
