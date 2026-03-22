import { Tray, Menu, nativeImage, app } from 'electron';
import { toggleOverlay, showSettings } from './window';

let tray: Tray | null = null;

// Minimal 16x16 RGBA PNG — solid dark-grey square as placeholder tray icon.
// Generated from the smallest valid PNG structure (IHDR + single-colour IDAT + IEND).
const TRAY_ICON_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAG0lEQVR4' +
  'AWMYBaNgFIyCUTAKRsEoGAWkYwAEEAABhLpMQAAAAABJRU5ErkJggg==';

function createTrayIcon() {
  const buf = Buffer.from(TRAY_ICON_BASE64, 'base64');
  return nativeImage.createFromBuffer(buf);
}

export function initTray(): void {
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }

  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('Stex');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show/Hide', click: () => toggleOverlay() },
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
