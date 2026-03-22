import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc';

contextBridge.exposeInMainWorld('settingsApi', {
  getSettings: () => ipcRenderer.invoke(IpcChannels.SETTINGS_GET),

  setSetting: (key: string, value: unknown) =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_SET, key, value),

  onSettingsUpdated: (callback: (settings: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, settings: unknown) => {
      callback(settings);
    };
    ipcRenderer.on(IpcChannels.SETTINGS_UPDATED, listener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.SETTINGS_UPDATED, listener);
    };
  },

  getAudioDevices: () => ipcRenderer.invoke(IpcChannels.AUDIO_GET_DEVICES),
});
