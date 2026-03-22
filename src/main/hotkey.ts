import { globalShortcut, Notification, app } from 'electron';
import { getSettings, onSettingsChanged } from './settings';
import { requestToggle } from './session';

let currentAccelerator: string | null = null;
let lastRequestedHotkey: string | null = null;
let unsubscribeSettings: (() => void) | null = null;
let quitHandler: (() => void) | null = null;

function registerHotkey(accelerator: string): boolean {
  lastRequestedHotkey = accelerator;

  try {
    const success = globalShortcut.register(accelerator, () => {
      requestToggle();
    });

    if (success) {
      if (currentAccelerator && currentAccelerator !== accelerator) {
        globalShortcut.unregister(currentAccelerator);
      }
      currentAccelerator = accelerator;
    } else {
      new Notification({
        title: 'Hotkey Registration Failed',
        body: `The shortcut ${accelerator} is already in use by another application. Open Settings to choose a different hotkey.`,
      }).show();
    }

    return success;
  } catch {
    new Notification({
      title: 'Hotkey Registration Failed',
      body: `The shortcut "${accelerator}" is not valid. Open Settings to choose a different hotkey.`,
    }).show();
    return false;
  }
}

export function initHotkeyManager(): void {
  if (unsubscribeSettings) {
    unsubscribeSettings();
    unsubscribeSettings = null;
  }
  if (currentAccelerator) {
    globalShortcut.unregister(currentAccelerator);
    currentAccelerator = null;
  }
  if (quitHandler) {
    app.removeListener('will-quit', quitHandler);
    quitHandler = null;
  }
  lastRequestedHotkey = null;

  const settings = getSettings();
  registerHotkey(settings.hotkey);

  unsubscribeSettings = onSettingsChanged((updated) => {
    if (updated.hotkey !== lastRequestedHotkey) {
      registerHotkey(updated.hotkey);
    }
  });

  quitHandler = () => {
    globalShortcut.unregisterAll();
    if (unsubscribeSettings) {
      unsubscribeSettings();
      unsubscribeSettings = null;
    }
  };
  app.on('will-quit', quitHandler);
}
