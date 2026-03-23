import { ipcMain } from 'electron';
import { IpcChannels } from '../shared/ipc';
import { logFromRenderer, isLogLevel } from './logger';

let handler: ((...args: unknown[]) => void) | null = null;

export function registerLogIpc(): void {
  if (handler) {
    ipcMain.removeListener(IpcChannels.LOG_FROM_RENDERER, handler);
  }

  handler = (_event: unknown, level: unknown, message: unknown) => {
    if (isLogLevel(level) && typeof message === 'string') {
      logFromRenderer(level, message);
    }
  };

  ipcMain.on(IpcChannels.LOG_FROM_RENDERER, handler);
}
