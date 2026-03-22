# T18: Theming — Implementation Notes

## Files Created

- `src/main/theme.ts` — Theme resolver: resolves effective theme (light/dark) from settings + nativeTheme, broadcasts changes via IPC, handles THEME_GET.
- `src/main/theme.test.ts` — Tests for resolveTheme() and initThemeManager().

## Files Modified

- `src/shared/ipc.ts` — Added `THEME_GET` and `THEME_RESOLVED` IPC channels.
- `src/shared/types.ts` — Added `ResolvedTheme` type alias.
- `src/main/index.ts` — Wired `initThemeManager()` into app startup.
- `src/main/preload.ts` — Added `getResolvedTheme()` and `onThemeChanged()` to overlay electronAPI.
- `src/main/preload-settings.ts` — Added `getResolvedTheme()` and `onThemeChanged()` to settings settingsApi.
- `src/renderer/types.d.ts` — Added theme methods to `ElectronAPI` interface.
- `src/renderer/settings/settingsApi.d.ts` — Added theme methods to `SettingsApi` interface.
- `src/renderer/overlay/overlay.css` — Converted all hardcoded colors to CSS variables with `:root` (light) and `[data-theme="dark"]` overrides.
- `src/renderer/settings/settings.css` — Same conversion. Added `color-scheme` property, explicit `background`/`color` for form controls, `accent-color` for range/checkbox.
- `src/renderer/overlay/index.tsx` — Added `initTheme()` to set `data-theme` attribute on document element.
- `src/renderer/settings/index.tsx` — Same theme initialization.

## Deviations from Plan

Post-review fixes (not in original plan):
- Added `background: var(--bg-content)` to `.settings-content` in settings.css (review caught missing content pane background).
- Added `.ghost-text` CSS rule consuming `--ghost-text-color` in overlay.css (review caught that the variable was defined but never consumed).
- Added `initialized` guard to `initThemeManager()` for idempotency, plus `_resetForTesting()` export for test isolation.

## New Tasks / Follow-up Work

- **BrowserWindow backgroundColor**: When creating windows in dark mode, there may be a brief white flash before CSS loads. A follow-up task could set `BrowserWindow.backgroundColor` dynamically based on the resolved theme at window creation time.
- **Error banner theming**: The error banner (mentioned in spec/ui.md) doesn't exist yet. When implemented, it should use the same CSS variable pattern.
