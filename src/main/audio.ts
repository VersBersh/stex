import { ipcMain } from 'electron';
import { getSettings } from './settings';
import { IpcChannels } from '../shared/ipc';
import { sendToRenderer } from './renderer-send';
import { info, debug } from './logger';

let capturing = false;
let dataHandler: ((chunk: Buffer) => void) | null = null;
let errorHandler: ((error: Error) => void) | null = null;

export function startCapture(
  onData: (chunk: Buffer) => void,
  onError: (error: Error) => void,
): void {
  if (capturing) {
    throw new Error('Audio capture is already active');
  }

  const { audioInputDevice } = getSettings();
  info('Audio capture starting (device: %s)', audioInputDevice ?? 'default');

  capturing = true;
  dataHandler = onData;
  errorHandler = onError;

  sendToRenderer(IpcChannels.AUDIO_START_CAPTURE, audioInputDevice);
}

export function stopCapture(): void {
  if (!capturing) return;
  debug('Audio capture stopped');

  capturing = false;
  dataHandler = null;
  errorHandler = null;

  sendToRenderer(IpcChannels.AUDIO_STOP_CAPTURE);
}

export function registerAudioIpc(): void {
  ipcMain.on(IpcChannels.AUDIO_CHUNK, (_event, chunk: Buffer) => {
    if (capturing && dataHandler) {
      dataHandler(chunk);
    }
  });

  ipcMain.on(IpcChannels.AUDIO_CAPTURE_ERROR, (_event, message: string) => {
    if (capturing && errorHandler) {
      sendToRenderer(IpcChannels.AUDIO_STOP_CAPTURE);

      const handler = errorHandler;
      capturing = false;
      dataHandler = null;
      errorHandler = null;
      handler(new Error(message));
    }
  });
}
