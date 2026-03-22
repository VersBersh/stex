import { Tray, Menu, nativeImage, app } from 'electron';
import * as path from 'path';
import { showSettings } from './window';
import { requestToggle } from './session';

let tray: Tray | null = null;

function createTrayIcon() {
  const iconPath = path.join(app.getAppPath(), 'resources', 'tray-icon.ico');
  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    throw new Error(`Tray icon not found at ${iconPath}`);
  }
  return icon;
}

export function initTray(): void {
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }

  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('Stex');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show/Hide', click: () => requestToggle() },
    { label: 'Settings', click: () => showSettings() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
}

export function destroyTray(): void {
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }
  tray = null;
}
