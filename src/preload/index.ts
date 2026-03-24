import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc';
import type { ElectronAPI } from '../shared/preload';
import type { AppSettings, SonioxToken, SessionState, ErrorInfo } from '../shared/types';

const api: ElectronAPI = {
  // Send (Renderer → Main, fire-and-forget)
  log: (level: string, message: string) => ipcRenderer.send(IpcChannels.LOG_FROM_RENDERER, level, message),

  // Invoke (Renderer → Main, request-response)
  settingsGet: () => ipcRenderer.invoke(IpcChannels.SETTINGS_GET),
  settingsSet: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_SET, key, value),

  // Invoke (Renderer → Main, request-response)
  getResolvedTheme: () => ipcRenderer.invoke(IpcChannels.THEME_GET),

  // Send (Renderer → Main, fire-and-forget)
  sessionRequestPause: () => ipcRenderer.send(IpcChannels.SESSION_REQUEST_PAUSE),
  sessionRequestResume: () => ipcRenderer.send(IpcChannels.SESSION_REQUEST_RESUME),
  sendSessionText: (text: string) => ipcRenderer.send(IpcChannels.SESSION_TEXT, text),
  sendContextText: (text: string) => ipcRenderer.send(IpcChannels.SESSION_CONTEXT, text),
  hideWindow: () => ipcRenderer.send(IpcChannels.WINDOW_HIDE),
  escapeHide: () => ipcRenderer.send(IpcChannels.WINDOW_ESCAPE_HIDE),
  openSettings: () => ipcRenderer.send(IpcChannels.SESSION_OPEN_SETTINGS),
  openMicSettings: () => ipcRenderer.send(IpcChannels.SESSION_OPEN_MIC_SETTINGS),
  dismissError: () => ipcRenderer.send(IpcChannels.SESSION_DISMISS_ERROR),

  // Listen (Main → Renderer, push events)
  onSessionStart: (callback: (onShow: 'fresh' | 'append') => void) => {
    const handler = (_event: unknown, onShow: 'fresh' | 'append') => callback(onShow);
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
  onRequestSessionText: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IpcChannels.SESSION_TEXT, handler);
    return () => { ipcRenderer.removeListener(IpcChannels.SESSION_TEXT, handler); };
  },
  onRequestContextText: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IpcChannels.SESSION_CONTEXT, handler);
    return () => { ipcRenderer.removeListener(IpcChannels.SESSION_CONTEXT, handler); };
  },
  onSettingsUpdated: (callback: (settings: AppSettings) => void) => {
    const handler = (_event: unknown, settings: AppSettings) => callback(settings);
    ipcRenderer.on(IpcChannels.SETTINGS_UPDATED, handler);
    return () => { ipcRenderer.removeListener(IpcChannels.SETTINGS_UPDATED, handler); };
  },
  onThemeChanged: (callback: (theme: 'light' | 'dark') => void) => {
    const handler = (_event: unknown, theme: 'light' | 'dark') => callback(theme);
    ipcRenderer.on(IpcChannels.THEME_RESOLVED, handler);
    return () => { ipcRenderer.removeListener(IpcChannels.THEME_RESOLVED, handler); };
  },
  onSessionError: (callback: (error: ErrorInfo | null) => void) => {
    const handler = (_event: unknown, error: ErrorInfo | null) => callback(error);
    ipcRenderer.on(IpcChannels.SESSION_ERROR, handler);
    return () => { ipcRenderer.removeListener(IpcChannels.SESSION_ERROR, handler); };
  },
  onAudioLevel: (callback: (dB: number) => void) => {
    const handler = (_event: unknown, dB: number) => callback(dB);
    ipcRenderer.on(IpcChannels.AUDIO_LEVEL, handler);
    return () => { ipcRenderer.removeListener(IpcChannels.AUDIO_LEVEL, handler); };
  },

  // Audio capture (Main → Renderer commands, Renderer → Main data)
  onAudioStartCapture: (callback: (deviceName: string | null) => void) => {
    const handler = (_event: unknown, deviceName: string | null) => callback(deviceName);
    ipcRenderer.on(IpcChannels.AUDIO_START_CAPTURE, handler);
    return () => { ipcRenderer.removeListener(IpcChannels.AUDIO_START_CAPTURE, handler); };
  },
  onAudioStopCapture: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IpcChannels.AUDIO_STOP_CAPTURE, handler);
    return () => { ipcRenderer.removeListener(IpcChannels.AUDIO_STOP_CAPTURE, handler); };
  },
  sendAudioChunk: (buffer: ArrayBuffer) => ipcRenderer.send(IpcChannels.AUDIO_CHUNK, Buffer.from(buffer)),
  sendAudioCaptureError: (message: string) => ipcRenderer.send(IpcChannels.AUDIO_CAPTURE_ERROR, message),
};

contextBridge.exposeInMainWorld('api', api);
