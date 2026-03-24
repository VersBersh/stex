import { ipcMain } from 'electron';
import portAudio, { IoStreamRead } from 'naudiodon';
import { getSettings } from './settings';
import type { AudioDevice } from '../shared/types';
import { IpcChannels } from '../shared/ipc';
import { info, debug } from './logger';

const PREFERRED_HOST_API = 'Windows WASAPI';

let activeStream: IoStreamRead | null = null;

function getAllInputDevices() {
  return portAudio.getDevices().filter(d => d.maxInputChannels > 0);
}

export function listDevices(): AudioDevice[] {
  const all = getAllInputDevices();
  // On Windows, PortAudio lists each physical device once per host API
  // (MME, DirectSound, WASAPI, WDM-KS). Show only WASAPI devices for a
  // clean list — they are the modern low-latency Windows audio API.
  const preferred = all.filter(d => d.hostAPIName === PREFERRED_HOST_API);
  const devices = preferred.length > 0 ? preferred : all;
  return devices.map(d => ({
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
    const all = getAllInputDevices();
    // Prefer WASAPI match, fall back to any host API match
    const wasapiMatch = all.find(d => d.name === audioInputDevice && d.hostAPIName === PREFERRED_HOST_API);
    const anyMatch = all.find(d => d.name === audioInputDevice);
    const match = wasapiMatch ?? anyMatch;
    if (!match) {
      throw new Error(`Audio device not found: ${audioInputDevice}`);
    }
    info('Audio device resolved: id=%d hostAPI=%s defaultRate=%d', match.id, match.hostAPIName, match.defaultSampleRate);
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
  const all = getAllInputDevices();
  for (const d of all) {
    debug('Input device: id=%d name=%s hostAPI=%s rate=%d ch=%d', d.id, d.name, d.hostAPIName, d.defaultSampleRate, d.maxInputChannels);
  }

  ipcMain.handle(IpcChannels.AUDIO_GET_DEVICES, () => {
    return listDevices().map(d => d.name);
  });
}
