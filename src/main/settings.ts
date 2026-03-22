import Store from 'electron-store';
import { ipcMain, BrowserWindow } from 'electron';
import { AppSettings } from '../shared/types';
import { IpcChannels } from '../shared/ipc';

/**
 * Resolves the effective Soniox API key using precedence rules:
 * 1. Non-empty saved value (from settings.json) wins
 * 2. Falls back to SONIOX_API_KEY environment variable
 * 3. Returns "" if neither is available
 */
export function resolveSonioxApiKey(savedValue: string): string {
  if (savedValue) {
    return savedValue;
  }
  return process.env.SONIOX_API_KEY ?? "";
}

export const APP_SETTINGS_DEFAULTS: AppSettings = {
  hotkey: 'Ctrl+Shift+Space',
  launchOnStartup: false,
  onHide: 'clipboard',
  onShow: 'fresh',
  audioInputDevice: null,
  sonioxApiKey: '',
  sonioxModel: 'stt-rt-preview',
  language: 'en',
  maxEndpointDelayMs: 1000,
  theme: 'system',
  windowPosition: null,
  windowSize: { width: 600, height: 300 },
};

const store = new Store<AppSettings>({ defaults: APP_SETTINGS_DEFAULTS });

const VALID_KEYS = new Set<keyof AppSettings>(
  Object.keys(APP_SETTINGS_DEFAULTS) as Array<keyof AppSettings>,
);

export function getSettings(): AppSettings {
  const result = {} as AppSettings;
  for (const key of VALID_KEYS) {
    (result as unknown as Record<string, unknown>)[key] = store.get(key);
  }
  result.sonioxApiKey = resolveSonioxApiKey(result.sonioxApiKey);
  return result;
}

const settingsListeners: Array<(settings: AppSettings) => void> = [];

export function onSettingsChanged(listener: (settings: AppSettings) => void): () => void {
  settingsListeners.push(listener);
  return () => {
    const idx = settingsListeners.indexOf(listener);
    if (idx >= 0) settingsListeners.splice(idx, 1);
  };
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  store.set(key, value);
  const updated = getSettings();
  for (const listener of [...settingsListeners]) {
    listener(updated);
  }
}

export function registerSettingsIpc(): void {
  ipcMain.handle(IpcChannels.SETTINGS_GET, () => getSettings());

  ipcMain.handle(IpcChannels.SETTINGS_SET, (_event, key: string, value: unknown) => {
    if (!VALID_KEYS.has(key as keyof AppSettings)) {
      throw new Error(`Unknown setting key: ${key}`);
    }
    setSetting(key as keyof AppSettings, value as AppSettings[keyof AppSettings]);
    const updated = getSettings();
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.SETTINGS_UPDATED, updated);
    }
  });
}
