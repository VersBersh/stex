import { app } from 'electron';
import { initWindowManager } from './window';
import { registerSettingsIpc } from './settings';
import { initTray } from './tray';

app.whenReady().then(() => {
  registerSettingsIpc();
  initWindowManager();
  initTray();
});

// Tray-resident app: don't quit when all windows are hidden/closed.
// The Tray Manager provides an explicit Quit menu item.
app.on('window-all-closed', () => {
  // Intentionally empty — prevent default quit behavior.
});
