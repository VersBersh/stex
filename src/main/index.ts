import { app } from 'electron';
import { initWindowManager } from './window';
import { registerSettingsIpc } from './settings';
import { initTray } from './tray';
import { initHotkeyManager } from './hotkey';
import { registerAudioIpc } from './audio';

app.whenReady().then(() => {
  registerSettingsIpc();
  registerAudioIpc();
  initWindowManager();
  initTray();
  initHotkeyManager();
});

// Tray-resident app: don't quit when all windows are hidden/closed.
// The Tray Manager provides an explicit Quit menu item.
app.on('window-all-closed', () => {
  // Intentionally empty — prevent default quit behavior.
});
