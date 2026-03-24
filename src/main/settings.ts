import * as fs from 'fs';
import * as path from 'path';
import Store from 'electron-store';
import { ipcMain, BrowserWindow, safeStorage, shell } from 'electron';
import { AppSettings, SILENCE_THRESHOLD_MIN, SILENCE_THRESHOLD_MAX } from '../shared/types';
import { IpcChannels } from '../shared/ipc';
import { getLogFilePath } from './logger';

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

function encryptApiKey(plaintext: string): string {
  if (!plaintext) return '';
  return safeStorage.encryptString(plaintext).toString('base64');
}

function decryptApiKey(stored: string): string {
  if (!stored) return '';
  try {
    return safeStorage.decryptString(Buffer.from(stored, 'base64'));
  } catch {
    // Legacy plaintext value — return as-is for migration
    return stored;
  }
}

function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 4) return key;
  return '\u2022'.repeat(key.length - 4) + key.slice(-4);
}

export const APP_SETTINGS_DEFAULTS: AppSettings = {
  hotkey: 'Ctrl+Shift+Space',
  launchOnStartup: false,
  onHide: 'clipboard',
  onShow: 'fresh',
  audioInputDevice: null,
  sonioxApiKey: '',
  sonioxModel: 'stt-rt-v4',
  language: 'en',
  maxEndpointDelayMs: 1000,
  theme: 'system',
  silenceThresholdDb: -30,
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
  result.sonioxApiKey = resolveSonioxApiKey(decryptApiKey(result.sonioxApiKey));
  return result;
}

export function getSettingsForRenderer(): AppSettings {
  const settings = getSettings();
  return { ...settings, sonioxApiKey: maskApiKey(settings.sonioxApiKey) };
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
  if (key === 'sonioxApiKey') {
    store.set(key, encryptApiKey(value as string) as AppSettings[K]);
  } else if (key === 'silenceThresholdDb') {
    const clamped = Math.max(SILENCE_THRESHOLD_MIN, Math.min(SILENCE_THRESHOLD_MAX, value as number));
    store.set(key, clamped as AppSettings[K]);
  } else {
    store.set(key, value);
  }
  const updated = getSettings();
  for (const listener of [...settingsListeners]) {
    listener(updated);
  }
}

export function registerSettingsIpc(): void {
  ipcMain.handle(IpcChannels.SETTINGS_GET, () => getSettingsForRenderer());

  ipcMain.handle(IpcChannels.LOG_PATH_GET, () => getLogFilePath());

  ipcMain.handle(IpcChannels.LOG_REVEAL, () => {
    const logPath = getLogFilePath();
    if (!logPath) return;
    if (fs.existsSync(logPath)) {
      shell.showItemInFolder(logPath);
    } else {
      shell.openPath(path.dirname(logPath));
    }
  });

  ipcMain.handle(IpcChannels.SETTINGS_SET, (_event, key: string, value: unknown) => {
    if (!VALID_KEYS.has(key as keyof AppSettings)) {
      throw new Error(`Unknown setting key: ${key}`);
    }
    setSetting(key as keyof AppSettings, value as AppSettings[keyof AppSettings]);
    const updated = getSettingsForRenderer();
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.SETTINGS_UPDATED, updated);
    }
  });
}
