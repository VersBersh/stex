import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc';

contextBridge.exposeInMainWorld('electronAPI', {
  hideWindow: () => ipcRenderer.send(IpcChannels.WINDOW_HIDE),
  requestPause: () => ipcRenderer.send(IpcChannels.SESSION_REQUEST_PAUSE),
  requestResume: () => ipcRenderer.send(IpcChannels.SESSION_REQUEST_RESUME),
  getResolvedTheme: () => ipcRenderer.invoke(IpcChannels.THEME_GET),
  onThemeChanged: (callback: (theme: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, theme: string) => {
      callback(theme);
    };
    ipcRenderer.on(IpcChannels.THEME_RESOLVED, listener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.THEME_RESOLVED, listener);
    };
  },
});
