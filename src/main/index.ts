import * as path from 'path';
import { app } from 'electron';
import { initWindowManager, showSettings } from './window';
import { registerSettingsIpc, getSettings } from './settings';
import { initTray } from './tray';
import { initHotkeyManager } from './hotkey';
import { registerAudioIpc } from './audio';
import { initThemeManager } from './theme';
import { initSessionManager } from './session';
import { initLogger, debug } from './logger';
import { registerLogIpc } from './log-ipc';

export function initApp(): void {
  const t0 = performance.now();
  const logDir = path.join(app.getPath('userData'), 'logs');
  initLogger({ logDir, level: app.isPackaged ? 'info' : 'debug' });
  registerLogIpc();
  debug('initApp: logger initialized (%.0fms)', performance.now() - t0);

  registerSettingsIpc();
  debug('initApp: settings IPC registered (%.0fms)', performance.now() - t0);

  registerAudioIpc();
  debug('initApp: audio IPC registered (%.0fms)', performance.now() - t0);

  initThemeManager();
  debug('initApp: theme manager initialized (%.0fms)', performance.now() - t0);

  initWindowManager();
  debug('initApp: window manager initialized (%.0fms)', performance.now() - t0);

  initSessionManager();
  debug('initApp: session manager initialized (%.0fms)', performance.now() - t0);

  initTray();
  debug('initApp: tray initialized (%.0fms)', performance.now() - t0);

  initHotkeyManager();
  debug('initApp: hotkey manager initialized (%.0fms)', performance.now() - t0);

  // First-run: auto-open settings if no API key configured
  const settings = getSettings();
  if (!settings.sonioxApiKey) {
    showSettings();
  }
}

app.whenReady().then(initApp);

// Tray-resident app: don't quit when all windows are hidden/closed.
// The Tray Manager provides an explicit Quit menu item.
app.on('window-all-closed', () => {
  // Intentionally empty — prevent default quit behavior.
});
