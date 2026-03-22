import { BrowserWindow, screen, app, ipcMain } from 'electron';
import * as path from 'path';
import { getSettings, setSetting } from './settings';
import { resolveTheme } from './theme';
import { IpcChannels } from '../shared/ipc';
import type { AppSettings } from '../shared/types';

let overlayWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let isAppQuitting = false;
let fadeAnimationId = 0; // incremented on each show to cancel stale fade callbacks

let moveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 300;

let closeRequestHandler: (() => void) | null = null;

export function setOverlayCloseHandler(handler: (() => void) | null): void {
  closeRequestHandler = handler;
}

function requestOverlayDismiss(): void {
  if (closeRequestHandler) {
    closeRequestHandler();
  } else {
    hideOverlay();
  }
}

export function getValidatedPosition(
  settings: AppSettings,
): { x: number; y: number } | undefined {
  const pos = settings.windowPosition;
  if (!pos) {
    return undefined;
  }

  const size = settings.windowSize;
  const displays = screen.getAllDisplays();

  for (const display of displays) {
    const area = display.workArea;
    const windowRight = pos.x + size.width;
    const windowBottom = pos.y + size.height;

    // Check if the window rectangle intersects the display's work area
    if (
      pos.x < area.x + area.width &&
      windowRight > area.x &&
      pos.y < area.y + area.height &&
      windowBottom > area.y
    ) {
      return { x: pos.x, y: pos.y };
    }
  }

  return undefined;
}

function createOverlayWindowInternal(): BrowserWindow {
  const settings = getSettings();
  const validatedPosition = getValidatedPosition(settings);
  const resolved = resolveTheme();

  const opts: Electron.BrowserWindowConstructorOptions = {
    width: settings.windowSize.width,
    height: settings.windowSize.height,
    minWidth: 400,
    minHeight: 200,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: resolved === 'dark' ? '#1e1e1e' : '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
    },
  };

  if (validatedPosition) {
    opts.x = validatedPosition.x;
    opts.y = validatedPosition.y;
  }

  const win = new BrowserWindow(opts);
  win.loadFile(path.join(__dirname, '../renderer/overlay/index.html'));

  // Opacity on focus/blur — suppressed during fade-in animation
  let isFading = false;

  win.on('focus', () => {
    if (!isFading) {
      win.setOpacity(1.0);
    }
  });

  win.on('blur', () => {
    if (!isFading) {
      win.setOpacity(0.95);
    }
  });

  // Close interception — convert close to hide unless app is quitting
  win.on('close', (e) => {
    if (!isAppQuitting) {
      e.preventDefault();
      requestOverlayDismiss();
    }
  });

  // Debounced position persistence on move
  win.on('move', () => {
    if (moveDebounceTimer) clearTimeout(moveDebounceTimer);
    moveDebounceTimer = setTimeout(() => {
      if (!win.isDestroyed()) {
        const [x, y] = win.getPosition();
        setSetting('windowPosition', { x, y });
      }
    }, DEBOUNCE_MS);
  });

  // Debounced size persistence on resize
  win.on('resize', () => {
    if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer);
    resizeDebounceTimer = setTimeout(() => {
      if (!win.isDestroyed()) {
        const [width, height] = win.getSize();
        setSetting('windowSize', { width, height });
      }
    }, DEBOUNCE_MS);
  });

  // Expose isFading control for showOverlay
  (win as BrowserWindow & { _setFading: (v: boolean) => void })._setFading = (v: boolean) => {
    isFading = v;
  };

  return win;
}

export function initWindowManager(): void {
  // Reset state for re-initialization (needed for tests)
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy();
  }
  overlayWindow = null;
  settingsWindow = null;
  isAppQuitting = false;

  overlayWindow = createOverlayWindowInternal();

  ipcMain.removeAllListeners(IpcChannels.WINDOW_HIDE);
  ipcMain.on(IpcChannels.WINDOW_HIDE, () => {
    if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
      requestOverlayDismiss();
    }
  });

  app.on('before-quit', () => {
    isAppQuitting = true;
  });
}

export function showOverlay(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  // Cancel any previous fade animation
  fadeAnimationId++;
  const currentFadeId = fadeAnimationId;

  // Restore saved position/size
  const settings = getSettings();
  const validatedPosition = getValidatedPosition(settings);

  // Set size
  const [currentWidth, currentHeight] = overlayWindow.getSize();
  const targetWidth = settings.windowSize.width;
  const targetHeight = settings.windowSize.height;
  if (currentWidth !== targetWidth || currentHeight !== targetHeight) {
    overlayWindow.setSize(targetWidth, targetHeight);
  }

  // Set position — center if validation fails
  if (validatedPosition) {
    overlayWindow.setPosition(validatedPosition.x, validatedPosition.y);
  } else {
    overlayWindow.center();
  }

  // Fade-in animation
  const setFading = (overlayWindow as BrowserWindow & { _setFading?: (v: boolean) => void })._setFading;
  if (setFading) setFading(true);

  overlayWindow.setOpacity(0);
  overlayWindow.show();
  overlayWindow.focus();

  const steps = 5;
  const stepDuration = 20; // 5 steps * 20ms = 100ms
  let currentStep = 0;

  const fadeIn = () => {
    // Cancel if a newer show/hide has occurred
    if (currentFadeId !== fadeAnimationId) return;
    currentStep++;
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const opacity = Math.min(1.0, currentStep / steps);
      overlayWindow.setOpacity(opacity);
      if (currentStep < steps) {
        setTimeout(fadeIn, stepDuration);
      } else {
        // Animation complete — re-enable focus/blur opacity and apply final state
        if (setFading) setFading(false);
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.setOpacity(overlayWindow.isFocused() ? 1.0 : 0.95);
        }
      }
    }
  };

  setTimeout(fadeIn, stepDuration);
}

export function hideOverlay(): void {
  if (!overlayWindow || overlayWindow.isDestroyed() || !overlayWindow.isVisible()) {
    return;
  }

  // Cancel any active fade animation
  fadeAnimationId++;

  // Save current position and size
  const [x, y] = overlayWindow.getPosition();
  const [width, height] = overlayWindow.getSize();
  setSetting('windowPosition', { x, y });
  setSetting('windowSize', { width, height });

  // Instant hide
  overlayWindow.hide();
}

export function showSettings(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  const resolved = resolveTheme();
  settingsWindow = new BrowserWindow({
    width: 600,
    height: 500,
    frame: true,
    skipTaskbar: false,
    backgroundColor: resolved === 'dark' ? '#1e1e1e' : '#f5f5f5',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/settings-preload.js'),
    },
  });

  settingsWindow.loadFile(path.join(__dirname, '../renderer/settings/index.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  settingsWindow.show();
  settingsWindow.focus();
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow;
}
