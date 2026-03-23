import { ipcMain } from 'electron';
import portAudio, { IoStreamRead } from 'naudiodon';
import { getSettings } from './settings';
import type { AudioDevice } from '../shared/types';
import { IpcChannels } from '../shared/ipc';
import { info, debug } from './logger';

let activeStream: IoStreamRead | null = null;

export function listDevices(): AudioDevice[] {
  return portAudio.getDevices()
    .filter(d => d.maxInputChannels > 0)
    .map(d => ({
      id: d.id,
      name: d.name,
      maxInputChannels: d.maxInputChannels,
      defaultSampleRate: d.defaultSampleRate,
    }));
}

export function startCapture(
  onData: (chunk: Buffer) => void,
  onError: (error: Error) => void,
): void {
  if (activeStream) {
    throw new Error('Audio capture is already active');
  }

  const { audioInputDevice } = getSettings();
  info('Audio capture starting (device: %s)', audioInputDevice ?? 'default');
  let deviceId = -1;

  if (audioInputDevice !== null) {
    const devices = listDevices();
    const match = devices.find(d => d.name === audioInputDevice);
    if (!match) {
      throw new Error(`Audio device not found: ${audioInputDevice}`);
    }
    deviceId = match.id;
  }

  const stream = portAudio.AudioIO({
    inOptions: {
      channelCount: 1,
      sampleFormat: portAudio.SampleFormat16Bit,
      sampleRate: 16000,
      deviceId,
      closeOnError: true,
    },
  });

  stream.on('data', (chunk: Buffer) => {
    onData(chunk);
  });

  stream.on('error', (err: Error) => {
    activeStream = null;
    stream.quit();
    onError(err);
  });

  // Set activeStream before start() so the error handler can find it,
  // and so cleanup works correctly if start() triggers a synchronous error event.
  activeStream = stream;

  try {
    stream.start();
    debug('Audio capture started');
  } catch (err) {
    activeStream = null;
    stream.quit();
    throw err;
  }
}

export function stopCapture(): void {
  if (!activeStream) {
    return;
  }
  debug('Audio capture stopped');
  const stream = activeStream;
  activeStream = null;
  stream.quit();
}

export function registerAudioIpc(): void {
  ipcMain.handle(IpcChannels.AUDIO_GET_DEVICES, () => {
    return listDevices().map(d => d.name);
  });
}
