import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc';

contextBridge.exposeInMainWorld('electronAPI', {
  hideWindow: () => ipcRenderer.send(IpcChannels.WINDOW_HIDE),
  escapeHide: () => ipcRenderer.send(IpcChannels.WINDOW_ESCAPE_HIDE),
  requestPause: () => ipcRenderer.send(IpcChannels.SESSION_REQUEST_PAUSE),
  requestResume: () => ipcRenderer.send(IpcChannels.SESSION_REQUEST_RESUME),
  openSettings: () => ipcRenderer.send(IpcChannels.SESSION_OPEN_SETTINGS),
  openMicSettings: () => ipcRenderer.send(IpcChannels.SESSION_OPEN_MIC_SETTINGS),
  dismissError: () => ipcRenderer.send(IpcChannels.SESSION_DISMISS_ERROR),
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
  onSessionStatus: (callback: (status: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: string) => {
      callback(status);
    };
    ipcRenderer.on(IpcChannels.SESSION_STATUS, listener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.SESSION_STATUS, listener);
    };
  },
  onSessionError: (callback: (error: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, error: unknown) => {
      callback(error);
    };
    ipcRenderer.on(IpcChannels.SESSION_ERROR, listener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.SESSION_ERROR, listener);
    };
  },
});
