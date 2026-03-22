import { Tray, Menu, nativeImage, app } from 'electron';
import * as path from 'path';
import { showSettings } from './window';
import { requestToggle } from './session';

let tray: Tray | null = null;
let flashTimer: ReturnType<typeof setTimeout> | null = null;

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

function createFlashIcon() {
  // Minimal 16x16 green (#4CAF50) PNG for clipboard-copy confirmation
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAH0lEQVQ4y2Nk+M9Qz0AFwMgwasCoAaMGjBpAIQAAWpYBAaFxthMAAAAASUVORK5CYII=',
  );
}

export function flashTrayIcon(): void {
  if (!tray || tray.isDestroyed()) return;

  // Cancel any in-progress flash
  if (flashTimer) {
    clearTimeout(flashTimer);
    flashTimer = null;
  }

  const normalIcon = createTrayIcon();
  const flashIcon = createFlashIcon();

  tray.setImage(flashIcon);

  flashTimer = setTimeout(() => {
    if (tray && !tray.isDestroyed()) {
      tray.setImage(normalIcon);
    }
    flashTimer = null;
  }, 600);
}

export function destroyTray(): void {
  if (flashTimer) {
    clearTimeout(flashTimer);
    flashTimer = null;
  }
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }
  tray = null;
}
