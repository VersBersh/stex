import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc';
import type { ElectronAPI } from '../shared/preload';
import type { AppSettings, SonioxToken, SessionState } from '../shared/types';

const api: ElectronAPI = {
  // Invoke (Renderer → Main, request-response)
  settingsGet: () => ipcRenderer.invoke(IpcChannels.SETTINGS_GET),
  settingsSet: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_SET, key, value),

  // Send (Renderer → Main, fire-and-forget)
  sessionRequestPause: () => ipcRenderer.send(IpcChannels.SESSION_REQUEST_PAUSE),
  sessionRequestResume: () => ipcRenderer.send(IpcChannels.SESSION_REQUEST_RESUME),
  sendSessionText: (text: string) => ipcRenderer.send(IpcChannels.SESSION_TEXT, text),

  // Listen (Main → Renderer, push events)
  onSessionStart: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IpcChannels.SESSION_START, handler);
    return () => { ipcRenderer.removeListener(IpcChannels.SESSION_START, handler); };
  },
  onSessionStop: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IpcChannels.SESSION_STOP, handler);
    return () => { ipcRenderer.removeListener(IpcChannels.SESSION_STOP, handler); };
  },
  onSessionPaused: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IpcChannels.SESSION_PAUSED, handler);
    return () => { ipcRenderer.removeListener(IpcChannels.SESSION_PAUSED, handler); };
  },
  onSessionResumed: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IpcChannels.SESSION_RESUMED, handler);
    return () => { ipcRenderer.removeListener(IpcChannels.SESSION_RESUMED, handler); };
  },
  onTokensFinal: (callback: (tokens: SonioxToken[]) => void) => {
    const handler = (_event: unknown, tokens: SonioxToken[]) => callback(tokens);
    ipcRenderer.on(IpcChannels.TOKENS_FINAL, handler);
    return () => { ipcRenderer.removeListener(IpcChannels.TOKENS_FINAL, handler); };
  },
  onTokensNonfinal: (callback: (tokens: SonioxToken[]) => void) => {
    const handler = (_event: unknown, tokens: SonioxToken[]) => callback(tokens);
    ipcRenderer.on(IpcChannels.TOKENS_NONFINAL, handler);
    return () => { ipcRenderer.removeListener(IpcChannels.TOKENS_NONFINAL, handler); };
  },
  onSessionStatus: (callback: (status: SessionState['status']) => void) => {
    const handler = (_event: unknown, status: SessionState['status']) => callback(status);
    ipcRenderer.on(IpcChannels.SESSION_STATUS, handler);
    return () => { ipcRenderer.removeListener(IpcChannels.SESSION_STATUS, handler); };
  },
  onSettingsUpdated: (callback: (settings: AppSettings) => void) => {
    const handler = (_event: unknown, settings: AppSettings) => callback(settings);
    ipcRenderer.on(IpcChannels.SETTINGS_UPDATED, handler);
    return () => { ipcRenderer.removeListener(IpcChannels.SETTINGS_UPDATED, handler); };
  },
};

contextBridge.exposeInMainWorld('api', api);
