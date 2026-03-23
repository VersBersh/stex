import * as path from 'path';
import { app } from 'electron';
import { initWindowManager, showSettings } from './window';
import { registerSettingsIpc, getSettings } from './settings';
import { initTray } from './tray';
import { initHotkeyManager } from './hotkey';
import { registerAudioIpc } from './audio';
import { initThemeManager } from './theme';
import { initSessionManager } from './session';
import { initLogger } from './logger';
import { registerLogIpc } from './log-ipc';

export function initApp(): void {
  const logDir = path.join(app.getPath('userData'), 'logs');
  initLogger({ logDir, level: app.isPackaged ? 'info' : 'debug' });
  registerLogIpc();

  registerSettingsIpc();
  registerAudioIpc();
  initThemeManager();
  initWindowManager();
  initSessionManager();
  initTray();
  initHotkeyManager();

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
