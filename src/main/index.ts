import { app } from 'electron';
import { createOverlayWindow } from './window';
import { registerSettingsIpc } from './settings';

app.whenReady().then(() => {
  registerSettingsIpc();
  createOverlayWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
