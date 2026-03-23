import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc';
import type { SettingsAPI } from '../shared/preload';
import type { AppSettings } from '../shared/types';

const settingsApi: SettingsAPI = {
  log: (level: string, message: string) => ipcRenderer.send(IpcChannels.LOG_FROM_RENDERER, level, message),

  getSettings: () => ipcRenderer.invoke(IpcChannels.SETTINGS_GET),

  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_SET, key, value),

  onSettingsUpdated: (callback: (settings: AppSettings) => void) => {
    const handler = (_event: unknown, settings: AppSettings) => callback(settings);
    ipcRenderer.on(IpcChannels.SETTINGS_UPDATED, handler);
    return () => { ipcRenderer.removeListener(IpcChannels.SETTINGS_UPDATED, handler); };
  },

  getAudioDevices: () => ipcRenderer.invoke(IpcChannels.AUDIO_GET_DEVICES),

  getResolvedTheme: () => ipcRenderer.invoke(IpcChannels.THEME_GET),

  getLogPath: () => ipcRenderer.invoke(IpcChannels.LOG_PATH_GET),

  revealLogFile: () => ipcRenderer.invoke(IpcChannels.LOG_REVEAL),

  onThemeChanged: (callback: (theme: 'light' | 'dark') => void) => {
    const handler = (_event: unknown, theme: 'light' | 'dark') => callback(theme);
    ipcRenderer.on(IpcChannels.THEME_RESOLVED, handler);
    return () => { ipcRenderer.removeListener(IpcChannels.THEME_RESOLVED, handler); };
  },
};

contextBridge.exposeInMainWorld('settingsApi', settingsApi);
