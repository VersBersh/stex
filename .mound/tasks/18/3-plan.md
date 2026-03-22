# T18: Theming — Implementation Plan

## Goal

Implement CSS-variable-based light/dark theming with system-following support, applied to both overlay and settings windows via a main-process theme resolver and IPC-based theme delivery.

## Steps

### Step 1: Add theme IPC channels and resolved-theme type

**Files**: `src/shared/ipc.ts`, `src/shared/types.ts`

- Add `THEME_GET: 'theme:get'` and `THEME_RESOLVED: 'theme:resolved'` to `IpcChannels`.
- Add `type ResolvedTheme = "light" | "dark"` export to `src/shared/types.ts`.

### Step 2: Add theme resolver to main process

**File**: `src/main/theme.ts` (new)

Create `src/main/theme.ts`:

```typescript
import { nativeTheme, BrowserWindow, ipcMain } from 'electron';
import { getSettings, onSettingsChanged } from './settings';
import { IpcChannels } from '../shared/ipc';
import type { ResolvedTheme } from '../shared/types';

let lastResolved: ResolvedTheme = 'light';

export function resolveTheme(): ResolvedTheme {
  const { theme } = getSettings();
  if (theme === 'system') {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  }
  return theme;
}

function broadcastIfChanged(): void {
  const resolved = resolveTheme();
  if (resolved !== lastResolved) {
    lastResolved = resolved;
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.THEME_RESOLVED, resolved);
    }
  }
}

export function initThemeManager(): void {
  lastResolved = resolveTheme();

  ipcMain.handle(IpcChannels.THEME_GET, () => resolveTheme());

  // React to setting changes — only broadcast when resolved theme actually changes
  onSettingsChanged(() => {
    broadcastIfChanged();
  });

  // React to OS theme changes (only matters when setting === "system")
  nativeTheme.on('updated', () => {
    broadcastIfChanged();
  });
}
```

Key improvement from review: tracks `lastResolved` and only broadcasts when the effective theme actually changes, avoiding unnecessary churn on unrelated settings changes.

### Step 3: Wire theme manager into app startup

**File**: `src/main/index.ts`

- Import `initThemeManager` from `./theme`.
- Call `initThemeManager()` after `registerSettingsIpc()` and before `initWindowManager()`.

### Step 4: Expose theme IPC in both preload scripts

**File**: `src/main/preload.ts`

Add to the `electronAPI` context bridge:
- `getResolvedTheme()` — calls `ipcRenderer.invoke(IpcChannels.THEME_GET)`.
- `onThemeChanged(callback)` — listens for `IpcChannels.THEME_RESOLVED`.

**File**: `src/main/preload-settings.ts`

Add to the `settingsApi` context bridge:
- `getResolvedTheme()` — same as above.
- `onThemeChanged(callback)` — same as above.

### Step 5: Update renderer type declarations

**File**: `src/renderer/types.d.ts`

Add to `ElectronAPI`:
```typescript
getResolvedTheme(): Promise<"light" | "dark">;
onThemeChanged(callback: (theme: "light" | "dark") => void): () => void;
```

**File**: `src/renderer/settings/settingsApi.d.ts`

Add to `SettingsApi`:
```typescript
getResolvedTheme(): Promise<"light" | "dark">;
onThemeChanged(callback: (theme: "light" | "dark") => void): () => void;
```

### Step 6: Convert overlay CSS to use CSS variables

**File**: `src/renderer/overlay/overlay.css`

Add `:root` block with light-theme CSS variables, and `[data-theme="dark"]` block with dark overrides. Replace all hardcoded color values with `var(--name)` references.

Light defaults (`:root`):
| Variable | Value | Used by |
|----------|-------|---------|
| `--bg-primary` | `#fff` | body, button bg |
| `--bg-secondary` | `#f0f0f0` | title bar |
| `--bg-tertiary` | `#f8f8f8` | status bar |
| `--text-primary` | `#1a1a1a` | body text |
| `--text-secondary` | `#666` | title bar btn, status left |
| `--text-muted` | `#444` | button text |
| `--border-color` | `#ddd` | title bar border, status bar border |
| `--border-color-light` | `#ccc` | button border |
| `--btn-bg` | `#fff` | status bar buttons |
| `--btn-hover-bg` | `#f0f0f0` | button hover |
| `--btn-hover-border` | `#bbb` | button hover border |
| `--btn-hover-text` | `#333` | title bar button hover text |
| `--confirm-color` | `#c00` | confirming button |
| `--ghost-text-color` | `#999` | ghost text (spec: light #999) |

Dark overrides (`[data-theme="dark"]`):
| Variable | Value |
|----------|-------|
| `--bg-primary` | `#1e1e1e` |
| `--bg-secondary` | `#2d2d2d` |
| `--bg-tertiary` | `#252525` |
| `--text-primary` | `#e0e0e0` |
| `--text-secondary` | `#aaa` |
| `--text-muted` | `#bbb` |
| `--border-color` | `#444` |
| `--border-color-light` | `#555` |
| `--btn-bg` | `#333` |
| `--btn-hover-bg` | `#3d3d3d` |
| `--btn-hover-border` | `#666` |
| `--btn-hover-text` | `#ddd` |
| `--confirm-color` | `#ff6b6b` |
| `--ghost-text-color` | `#666` |

### Step 7: Convert settings CSS to use CSS variables

**File**: `src/renderer/settings/settings.css`

Same approach. Additionally, add `color-scheme: light` to `:root` and `color-scheme: dark` to `[data-theme="dark"]` to ensure native form controls (inputs, selects, checkboxes, range sliders) adopt the correct appearance. Also add explicit `background` and `color` styling for `input[type="text"]`, `input[type="password"]`, and `select` elements.

Light defaults (`:root`):
| Variable | Value | Used by |
|----------|-------|---------|
| `--bg-primary` | `#f5f5f5` | body |
| `--bg-sidebar` | `#e8e8e8` | sidebar |
| `--bg-content` | `#fff` | sidebar active, content bg |
| `--text-primary` | `#1a1a1a` | body, headings, active sidebar |
| `--text-secondary` | `#444` | sidebar buttons, btn text |
| `--text-muted` | `#888` | hints, loading, recorder text |
| `--text-subtle` | `#555` | range value |
| `--text-label` | `#333` | labels |
| `--border-color` | `#d0d0d0` | sidebar border |
| `--border-color-light` | `#ccc` | button, input, hotkey, recorder borders |
| `--sidebar-hover` | `#d8d8d8` | sidebar button hover |
| `--accent-color` | `#0066cc` | active indicator, focus, primary btn |
| `--accent-hover` | `#0055aa` | primary btn hover |
| `--btn-bg` | `#fff` | btn background |
| `--btn-hover-bg` | `#f0f0f0` | btn hover |
| `--input-bg` | `#fff` | input/select background |
| `--input-focus-shadow` | `rgba(0, 102, 204, 0.15)` | focus ring |
| `--hotkey-bg` | `#fff` | hotkey display |
| `--recorder-active-bg` | `#f0f7ff` | hotkey recorder active |

Dark overrides (`[data-theme="dark"]`):
| Variable | Value |
|----------|-------|
| `--bg-primary` | `#1e1e1e` |
| `--bg-sidebar` | `#252525` |
| `--bg-content` | `#2d2d2d` |
| `--text-primary` | `#e0e0e0` |
| `--text-secondary` | `#bbb` |
| `--text-muted` | `#888` |
| `--text-subtle` | `#999` |
| `--text-label` | `#ccc` |
| `--border-color` | `#444` |
| `--border-color-light` | `#555` |
| `--sidebar-hover` | `#333` |
| `--accent-color` | `#4da6ff` |
| `--accent-hover` | `#3d96ef` |
| `--btn-bg` | `#333` |
| `--btn-hover-bg` | `#3d3d3d` |
| `--input-bg` | `#333` |
| `--input-focus-shadow` | `rgba(77, 166, 255, 0.2)` |
| `--hotkey-bg` | `#333` |
| `--recorder-active-bg` | `#1a2a3a` |

Form control additions in the CSS rules (not just variable definitions):
- `select`: add `background: var(--input-bg); color: var(--text-primary);`
- `input[type="text"], input[type="password"]`: add `background: var(--input-bg); color: var(--text-primary);`
- `input[type="range"]`: add `accent-color: var(--accent-color);`
- `input[type="checkbox"]`: add `accent-color: var(--accent-color);`

### Step 8: Add theme application logic to overlay renderer

**File**: `src/renderer/overlay/index.tsx`

Before `createRoot`, add theme initialization:

```typescript
function initTheme() {
  window.electronAPI.getResolvedTheme().then((theme) => {
    document.documentElement.setAttribute('data-theme', theme);
  });

  window.electronAPI.onThemeChanged((newTheme) => {
    document.documentElement.setAttribute('data-theme', newTheme);
  });
}

initTheme();
```

This sets `data-theme` on `<html>`, which activates the CSS variable overrides.

### Step 9: Add theme application logic to settings renderer

**File**: `src/renderer/settings/index.tsx`

Same pattern — before `createRoot`:

```typescript
function initTheme() {
  window.settingsApi.getResolvedTheme().then((theme) => {
    document.documentElement.setAttribute('data-theme', theme);
  });

  window.settingsApi.onThemeChanged((newTheme) => {
    document.documentElement.setAttribute('data-theme', newTheme);
  });
}

initTheme();
```

### Step 10: Add tests for theme resolver

**File**: `src/main/theme.test.ts` (new)

Test cases:
- `resolveTheme()` returns `'light'` when setting is `'light'`
- `resolveTheme()` returns `'dark'` when setting is `'dark'`
- `resolveTheme()` returns `'dark'` when setting is `'system'` and `nativeTheme.shouldUseDarkColors === true`
- `resolveTheme()` returns `'light'` when setting is `'system'` and `nativeTheme.shouldUseDarkColors === false`
- `initThemeManager()` registers `ipcMain.handle` for `THEME_GET`
- `initThemeManager()` broadcasts to all windows when resolved theme changes
- `initThemeManager()` does NOT broadcast when resolved theme hasn't changed
- `initThemeManager()` broadcasts on nativeTheme `updated` when setting is `'system'` and theme changes

## Risks / Open Questions

1. **Why main-process theme resolution over renderer `matchMedia`**: The reviewer suggested resolving `"system"` in the renderer via `matchMedia('(prefers-color-scheme: dark)')`. However, Electron's `matchMedia` only reflects `nativeTheme.themeSource` and may not reliably mirror the OS setting. The canonical Electron approach is `nativeTheme.shouldUseDarkColors` from the main process. The added IPC surface (2 channels) is minimal and keeps theme logic centralized.

2. **Flash of wrong theme**: On first load, `:root` defaults to light theme variables. Since light is the common default and Electron windows load before showing, the flash should be negligible. A follow-up could set `BrowserWindow.backgroundColor` based on resolved theme at creation time.

3. **Spec update for settings window theming**: The reviewer noted that `spec/ui.md` doesn't explicitly state the settings window uses the effective theme. The task description's acceptance criteria already say "Both overlay and settings windows respect the theme", which is authoritative. We don't need to update the spec for what is already in the task scope.
