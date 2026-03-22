import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc';

contextBridge.exposeInMainWorld('electronAPI', {
  hideWindow: () => ipcRenderer.send(IpcChannels.WINDOW_HIDE),
  requestPause: () => ipcRenderer.send(IpcChannels.SESSION_REQUEST_PAUSE),
  requestResume: () => ipcRenderer.send(IpcChannels.SESSION_REQUEST_RESUME),
});
