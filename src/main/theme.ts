import { nativeTheme, BrowserWindow, ipcMain } from 'electron';
import { getSettings, onSettingsChanged } from './settings';
import { IpcChannels } from '../shared/ipc';
import type { ResolvedTheme } from '../shared/types';

let lastResolved: ResolvedTheme = 'light';
let initialized = false;

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
  if (initialized) return;
  initialized = true;
  lastResolved = resolveTheme();

  ipcMain.handle(IpcChannels.THEME_GET, () => resolveTheme());

  onSettingsChanged(() => {
    broadcastIfChanged();
  });

  nativeTheme.on('updated', () => {
    broadcastIfChanged();
  });
}

/** @internal Reset module state for tests only */
export function _resetForTesting(): void {
  initialized = false;
  lastResolved = 'light';
}
