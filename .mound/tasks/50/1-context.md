# T50: Context

## Relevant Files

| File | Role |
|------|------|
| `src/main/window.ts` | Window Manager — creates overlay and settings BrowserWindows. Both currently lack `backgroundColor`. |
| `src/main/theme.ts` | Theme Manager — `resolveTheme()` returns `'light'` or `'dark'` accounting for system preference. |
| `src/main/settings.ts` | Settings Store — provides `getSettings()` which includes the `theme` preference. |
| `src/shared/types.ts` | Shared types — defines `AppSettings` (with `theme: 'system' | 'light' | 'dark'`) and `ResolvedTheme`. |
| `src/renderer/overlay/overlay.css` | Overlay CSS — light `--bg-primary: #fff`, dark `--bg-primary: #1e1e1e`. |
| `src/renderer/settings/settings.css` | Settings CSS — light `--bg-primary: #f5f5f5`, dark `--bg-primary: #1e1e1e`. |
| `src/main/window-construction.test.ts` | Tests for overlay window construction options. |
| `src/main/settings-window.test.ts` | Tests for settings window construction options. |
| `src/main/theme.test.ts` | Tests for `resolveTheme()` and theme broadcasting. |
| `spec/ui.md` | UI spec — mentions themes section but no backgroundColor detail. |

## Architecture

The **Window Manager** (`window.ts`) creates two BrowserWindows:
1. **Overlay** — frameless, always-on-top, created at startup via `createOverlayWindowInternal()` (line 52). Uses `transparent: false`, `show: false`.
2. **Settings** — standard framed window, created on-demand via `showSettings()` (line 247).

Both windows currently have no `backgroundColor` set, so Electron defaults to white (`#fff`). Before the renderer CSS loads and the `[data-theme]` attribute is applied, there's a brief white flash in dark mode.

The **Theme Manager** (`theme.ts`) already provides `resolveTheme()` which resolves `'system' | 'light' | 'dark'` to a concrete `'light' | 'dark'` by consulting `nativeTheme.shouldUseDarkColors`. This is available synchronously and can be called at window creation time.

CSS theming uses `[data-theme="dark"]` selectors with CSS variables. The background colors are:
- Overlay: light=`#fff`, dark=`#1e1e1e`
- Settings: light=`#f5f5f5`, dark=`#1e1e1e`
