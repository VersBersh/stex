import { getOverlayWindow } from './window';
import { IpcChannels } from '../shared/ipc';
import type { SessionState, ErrorInfo } from '../shared/types';

export function sendToRenderer(channel: string, ...args: unknown[]): void {
  const win = getOverlayWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}

export function sendStatus(status: SessionState['status']): void {
  sendToRenderer(IpcChannels.SESSION_STATUS, status);
}

export function sendError(error: ErrorInfo | null): void {
  sendToRenderer(IpcChannels.SESSION_ERROR, error);
}

export function clearError(): void {
  sendError(null);
}
