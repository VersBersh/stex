import { ipcMain, shell } from 'electron';
import { IpcChannels } from '../shared/ipc';
import { showSettings } from './window';

export interface SessionIpcActions {
  onPause: () => void;
  onResume: () => void;
  onDismissError: () => void;
  onEscapeHide: () => void;
}

let pauseHandler: ((...args: unknown[]) => void) | null = null;
let resumeHandler: ((...args: unknown[]) => void) | null = null;
let dismissErrorHandler: ((...args: unknown[]) => void) | null = null;
let openSettingsHandler: ((...args: unknown[]) => void) | null = null;
let openMicSettingsHandler: ((...args: unknown[]) => void) | null = null;
let escapeHideHandler: ((...args: unknown[]) => void) | null = null;

function removeHandler(channel: string, handler: ((...args: unknown[]) => void) | null): void {
  if (handler) {
    ipcMain.removeListener(channel, handler);
  }
}

export function registerSessionIpc(actions: SessionIpcActions): void {
  removeHandler(IpcChannels.SESSION_REQUEST_PAUSE, pauseHandler);
  removeHandler(IpcChannels.SESSION_REQUEST_RESUME, resumeHandler);
  removeHandler(IpcChannels.SESSION_DISMISS_ERROR, dismissErrorHandler);
  removeHandler(IpcChannels.SESSION_OPEN_SETTINGS, openSettingsHandler);
  removeHandler(IpcChannels.SESSION_OPEN_MIC_SETTINGS, openMicSettingsHandler);
  removeHandler(IpcChannels.WINDOW_ESCAPE_HIDE, escapeHideHandler);

  pauseHandler = () => { actions.onPause(); };
  resumeHandler = () => { actions.onResume(); };
  dismissErrorHandler = () => { actions.onDismissError(); };
  openSettingsHandler = () => { showSettings(); };
  openMicSettingsHandler = () => { shell.openExternal('ms-settings:privacy-microphone'); };
  escapeHideHandler = () => { actions.onEscapeHide(); };

  ipcMain.on(IpcChannels.SESSION_REQUEST_PAUSE, pauseHandler);
  ipcMain.on(IpcChannels.SESSION_REQUEST_RESUME, resumeHandler);
  ipcMain.on(IpcChannels.SESSION_DISMISS_ERROR, dismissErrorHandler);
  ipcMain.on(IpcChannels.SESSION_OPEN_SETTINGS, openSettingsHandler);
  ipcMain.on(IpcChannels.SESSION_OPEN_MIC_SETTINGS, openMicSettingsHandler);
  ipcMain.on(IpcChannels.WINDOW_ESCAPE_HIDE, escapeHideHandler);
}
