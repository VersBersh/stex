# T50: Plan

## Goal

Set `BrowserWindow.backgroundColor` at window creation time based on the resolved theme to prevent a white flash when opening windows in dark mode.

## Steps

### 1. Import `resolveTheme` in `window.ts`

Add an import of `resolveTheme` from `./theme` to `src/main/window.ts`:

```ts
import { resolveTheme } from './theme';
```

No helper function is needed — the color mapping is trivial and window-specific, so it's kept inline in each window constructor.

### 2. Set `backgroundColor` on overlay window in `window.ts`

In `createOverlayWindowInternal()` (line 52), call `resolveTheme()` and set `backgroundColor` in the opts object. Colors match `--bg-primary` in `overlay.css`: light=`#ffffff`, dark=`#1e1e1e`.

```ts
const resolved = resolveTheme();
const opts = {
  // ... existing options ...
  backgroundColor: resolved === 'dark' ? '#1e1e1e' : '#ffffff',
};
```

### 3. Set `backgroundColor` on settings window in `window.ts`

In `showSettings()` (line 253), call `resolveTheme()` and set `backgroundColor`. Colors match `--bg-primary` in `settings.css`: light=`#f5f5f5`, dark=`#1e1e1e`.

```ts
const resolved = resolveTheme();
settingsWindow = new BrowserWindow({
  // ... existing options ...
  backgroundColor: resolved === 'dark' ? '#1e1e1e' : '#f5f5f5',
});
```

### 4. Add backgroundColor tests in `window-construction.test.ts`

Add a mock for `./theme` returning a controllable resolved theme, then add tests:
- Overlay gets `backgroundColor: '#ffffff'` when theme resolves to light
- Overlay gets `backgroundColor: '#1e1e1e'` when theme resolves to dark

### 5. Add backgroundColor tests in `settings-window.test.ts`

Same approach but for the settings window:
- Settings window gets `backgroundColor: '#f5f5f5'` when theme resolves to light
- Settings window gets `backgroundColor: '#1e1e1e'` when theme resolves to dark

## Risks / Open Questions

- **Circular dependency**: `window.ts` already imports from `./settings`, and `theme.ts` also imports from `./settings`. Importing `theme.ts` from `window.ts` adds no new circular dependency since `theme.ts` does not import from `window.ts`.
- **Theme initialization order**: `resolveTheme()` calls `getSettings()` and reads `nativeTheme.shouldUseDarkColors` — both are available synchronously before `initThemeManager()` is called. `resolveTheme()` does not depend on `initThemeManager()` having been called.
