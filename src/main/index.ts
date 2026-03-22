import { app } from 'electron';
import { initWindowManager } from './window';
import { registerSettingsIpc } from './settings';

app.whenReady().then(() => {
  registerSettingsIpc();
  initWindowManager();
});

// Tray-resident app: don't quit when all windows are hidden/closed.
// The Tray Manager (future task) will provide an explicit Quit menu item.
app.on('window-all-closed', () => {
  // Intentionally empty — prevent default quit behavior.
});
