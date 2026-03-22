import { BrowserWindow } from 'electron';
import * as path from 'path';

let overlayWindow: BrowserWindow | null = null;

export function createOverlayWindow(): BrowserWindow {
  overlayWindow = new BrowserWindow({
    width: 600,
    height: 300,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  overlayWindow.loadFile(path.join(__dirname, '../renderer/overlay/index.html'));

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  return overlayWindow;
}
