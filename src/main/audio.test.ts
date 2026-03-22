import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';

const { mockDevices, mockSettings, lastCreatedStream, mockGetDevices, SampleFormat16Bit, mockHandlers } = vi.hoisted(() => {
  const mockDevices = [
    { id: 0, name: 'Built-in Microphone', maxInputChannels: 2, maxOutputChannels: 0, defaultSampleRate: 44100 },
    { id: 1, name: 'USB Headset', maxInputChannels: 1, maxOutputChannels: 2, defaultSampleRate: 48000 },
    { id: 2, name: 'Speakers', maxInputChannels: 0, maxOutputChannels: 2, defaultSampleRate: 44100 },
    { id: 3, name: 'Virtual Cable', maxInputChannels: 2, maxOutputChannels: 2, defaultSampleRate: 44100 },
  ];

  const mockSettings = {
    audioInputDevice: null as string | null,
  };

  const lastCreatedStream = { value: null as null | {
    options: unknown;
    started: boolean;
    stopped: boolean;
    emit: (event: string, ...args: unknown[]) => boolean;
  } };

  const mockGetDevices = vi.fn(() => [...mockDevices]);
  const SampleFormat16Bit = 16;

  const mockHandlers = new Map<string, (...args: unknown[]) => unknown>();

  return { mockDevices, mockSettings, lastCreatedStream, mockGetDevices, SampleFormat16Bit, mockHandlers };
});

vi.mock('naudiodon', () => {
  // naudiodon's AudioIO is a factory function, not a class
  function MockAudioIO(options: unknown) {
    const emitter = Object.assign(new EventEmitter(), {
      options,
      started: false,
      stopped: false,
      start() { this.started = true; },
      quit() { this.stopped = true; },
    });
    lastCreatedStream.value = emitter;
    return emitter;
  }

  return {
    default: {
      AudioIO: MockAudioIO,
      getDevices: mockGetDevices,
      SampleFormat16Bit,
    },
    AudioIO: MockAudioIO,
    getDevices: mockGetDevices,
    SampleFormat16Bit,
  };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      mockHandlers.set(channel, handler);
    },
  },
}));

vi.mock('./settings', () => ({
  getSettings: () => mockSettings,
}));

import { listDevices, startCapture, stopCapture, registerAudioIpc } from './audio';
import { IpcChannels } from '../shared/ipc';

describe('listDevices', () => {
  beforeEach(() => {
    mockGetDevices.mockReturnValue([...mockDevices]);
  });

  it('returns only devices with input channels', () => {
    const devices = listDevices();
    expect(devices).toHaveLength(3);
    expect(devices.every(d => d.maxInputChannels > 0)).toBe(true);
  });

  it('excludes output-only devices', () => {
    const devices = listDevices();
    const names = devices.map(d => d.name);
    expect(names).not.toContain('Speakers');
  });

  it('maps to AudioDevice shape', () => {
    const devices = listDevices();
    expect(devices[0]).toEqual({
      id: 0,
      name: 'Built-in Microphone',
      maxInputChannels: 2,
      defaultSampleRate: 44100,
    });
  });
});

describe('startCapture', () => {
  beforeEach(() => {
    mockSettings.audioInputDevice = null;
    mockGetDevices.mockReturnValue([...mockDevices]);
    lastCreatedStream.value = null;
    stopCapture();
  });

  it('creates AudioIO with correct PCM s16le 16kHz mono parameters', () => {
    startCapture(vi.fn(), vi.fn());

    const stream = lastCreatedStream.value!;
    const opts = (stream.options as { inOptions: Record<string, unknown> }).inOptions;
    expect(opts.channelCount).toBe(1);
    expect(opts.sampleFormat).toBe(SampleFormat16Bit);
    expect(opts.sampleRate).toBe(16000);
    stopCapture();
  });

  it('uses default device (-1) when audioInputDevice is null', () => {
    mockSettings.audioInputDevice = null;
    startCapture(vi.fn(), vi.fn());

    const stream = lastCreatedStream.value!;
    const opts = (stream.options as { inOptions: Record<string, unknown> }).inOptions;
    expect(opts.deviceId).toBe(-1);
    stopCapture();
  });

  it('resolves device by name from settings', () => {
    mockSettings.audioInputDevice = 'USB Headset';
    startCapture(vi.fn(), vi.fn());

    const stream = lastCreatedStream.value!;
    const opts = (stream.options as { inOptions: Record<string, unknown> }).inOptions;
    expect(opts.deviceId).toBe(1);
    stopCapture();
  });

  it('throws when configured device name is not found', () => {
    mockSettings.audioInputDevice = 'Nonexistent Device';
    expect(() => startCapture(vi.fn(), vi.fn())).toThrow('Audio device not found: Nonexistent Device');
  });

  it('throws when called while already capturing', () => {
    startCapture(vi.fn(), vi.fn());
    expect(() => startCapture(vi.fn(), vi.fn())).toThrow('Audio capture is already active');
    stopCapture();
  });

  it('calls onData when stream emits data', () => {
    const onData = vi.fn();
    startCapture(onData, vi.fn());

    const chunk = Buffer.alloc(3200);
    lastCreatedStream.value!.emit('data', chunk);
    expect(onData).toHaveBeenCalledWith(chunk);
    stopCapture();
  });

  it('starts the stream', () => {
    startCapture(vi.fn(), vi.fn());
    expect(lastCreatedStream.value!.started).toBe(true);
    stopCapture();
  });
});

describe('stopCapture', () => {
  beforeEach(() => {
    mockSettings.audioInputDevice = null;
    mockGetDevices.mockReturnValue([...mockDevices]);
    lastCreatedStream.value = null;
    stopCapture();
  });

  it('calls quit on the active stream', () => {
    startCapture(vi.fn(), vi.fn());
    const stream = lastCreatedStream.value!;
    stopCapture();
    expect(stream.stopped).toBe(true);
  });

  it('is a no-op when not capturing', () => {
    expect(() => stopCapture()).not.toThrow();
  });

  it('allows starting a new capture after stopping', () => {
    startCapture(vi.fn(), vi.fn());
    stopCapture();
    expect(() => startCapture(vi.fn(), vi.fn())).not.toThrow();
    stopCapture();
  });
});

describe('stream error handling', () => {
  beforeEach(() => {
    mockSettings.audioInputDevice = null;
    mockGetDevices.mockReturnValue([...mockDevices]);
    lastCreatedStream.value = null;
    stopCapture();
  });

  it('calls onError and stops capture when stream emits error', () => {
    const onError = vi.fn();
    startCapture(vi.fn(), onError);

    const stream = lastCreatedStream.value!;
    const error = new Error('Device disconnected');
    stream.emit('error', error);

    expect(onError).toHaveBeenCalledWith(error);
    expect(stream.stopped).toBe(true);
  });

  it('allows restarting after a stream error', () => {
    const onError = vi.fn();
    startCapture(vi.fn(), onError);

    lastCreatedStream.value!.emit('error', new Error('Device disconnected'));

    expect(() => startCapture(vi.fn(), vi.fn())).not.toThrow();
    stopCapture();
  });
});

describe('registerAudioIpc', () => {
  beforeEach(() => {
    mockHandlers.clear();
  });

  it('registers a handler for AUDIO_GET_DEVICES', () => {
    registerAudioIpc();
    expect(mockHandlers.has(IpcChannels.AUDIO_GET_DEVICES)).toBe(true);
  });

  it('AUDIO_GET_DEVICES handler returns an empty array', async () => {
    registerAudioIpc();
    const handler = mockHandlers.get(IpcChannels.AUDIO_GET_DEVICES)!;
    const result = await handler({});
    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });
});
