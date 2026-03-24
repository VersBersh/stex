import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockSettings, mockHandlers, mockSendToRenderer } = vi.hoisted(() => {
  const mockSettings = {
    audioInputDevice: null as string | null,
  };

  const mockHandlers = new Map<string, (...args: unknown[]) => unknown>();
  const mockSendToRenderer = vi.fn();

  return { mockSettings, mockHandlers, mockSendToRenderer };
});

vi.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, handler: (...args: unknown[]) => unknown) => {
      mockHandlers.set(channel, handler);
    },
  },
}));

vi.mock('./settings', () => ({
  getSettings: () => mockSettings,
}));

vi.mock('./renderer-send', () => ({
  sendToRenderer: (...args: unknown[]) => mockSendToRenderer(...args),
}));

vi.mock('./logger');

import { startCapture, stopCapture, registerAudioIpc } from './audio';
import { IpcChannels } from '../shared/ipc';

describe('startCapture', () => {
  beforeEach(() => {
    mockSettings.audioInputDevice = null;
    mockSendToRenderer.mockClear();
    stopCapture();
  });

  it('sends AUDIO_START_CAPTURE to renderer with device name', () => {
    mockSettings.audioInputDevice = 'USB Headset';
    startCapture(vi.fn(), vi.fn());

    expect(mockSendToRenderer).toHaveBeenCalledWith(
      IpcChannels.AUDIO_START_CAPTURE,
      'USB Headset',
    );
    stopCapture();
  });

  it('sends null device name when audioInputDevice is null', () => {
    mockSettings.audioInputDevice = null;
    startCapture(vi.fn(), vi.fn());

    expect(mockSendToRenderer).toHaveBeenCalledWith(
      IpcChannels.AUDIO_START_CAPTURE,
      null,
    );
    stopCapture();
  });

  it('throws when called while already capturing', () => {
    startCapture(vi.fn(), vi.fn());
    expect(() => startCapture(vi.fn(), vi.fn())).toThrow('Audio capture is already active');
    stopCapture();
  });
});

describe('stopCapture', () => {
  beforeEach(() => {
    mockSettings.audioInputDevice = null;
    mockSendToRenderer.mockClear();
    stopCapture();
  });

  it('sends AUDIO_STOP_CAPTURE to renderer', () => {
    startCapture(vi.fn(), vi.fn());
    mockSendToRenderer.mockClear();
    stopCapture();

    expect(mockSendToRenderer).toHaveBeenCalledWith(IpcChannels.AUDIO_STOP_CAPTURE);
  });

  it('is a no-op when not capturing', () => {
    mockSendToRenderer.mockClear();
    stopCapture();
    expect(mockSendToRenderer).not.toHaveBeenCalled();
  });

  it('allows starting a new capture after stopping', () => {
    startCapture(vi.fn(), vi.fn());
    stopCapture();
    expect(() => startCapture(vi.fn(), vi.fn())).not.toThrow();
    stopCapture();
  });
});

describe('registerAudioIpc', () => {
  beforeEach(() => {
    mockHandlers.clear();
    mockSendToRenderer.mockClear();
    stopCapture();
  });

  it('registers handlers for AUDIO_CHUNK and AUDIO_CAPTURE_ERROR', () => {
    registerAudioIpc();
    expect(mockHandlers.has(IpcChannels.AUDIO_CHUNK)).toBe(true);
    expect(mockHandlers.has(IpcChannels.AUDIO_CAPTURE_ERROR)).toBe(true);
  });

  it('AUDIO_CHUNK handler calls onData callback with buffer', () => {
    registerAudioIpc();
    const onData = vi.fn();
    startCapture(onData, vi.fn());

    const chunk = Buffer.alloc(3200);
    const handler = mockHandlers.get(IpcChannels.AUDIO_CHUNK)!;
    handler({}, chunk);

    expect(onData).toHaveBeenCalledWith(chunk);
    stopCapture();
  });

  it('AUDIO_CHUNK handler is a no-op when not capturing', () => {
    registerAudioIpc();
    const handler = mockHandlers.get(IpcChannels.AUDIO_CHUNK)!;

    // Should not throw
    expect(() => handler({}, Buffer.alloc(100))).not.toThrow();
  });

  it('AUDIO_CAPTURE_ERROR handler sends stop to renderer before calling onError', () => {
    registerAudioIpc();
    const onError = vi.fn();
    startCapture(vi.fn(), onError);
    mockSendToRenderer.mockClear();

    const handler = mockHandlers.get(IpcChannels.AUDIO_CAPTURE_ERROR)!;
    handler({}, 'Microphone access denied');

    // Should have sent stop command to renderer
    expect(mockSendToRenderer).toHaveBeenCalledWith(IpcChannels.AUDIO_STOP_CAPTURE);
    // Should have called onError
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Microphone access denied',
    }));
  });

  it('AUDIO_CAPTURE_ERROR handler clears capturing state', () => {
    registerAudioIpc();
    startCapture(vi.fn(), vi.fn());

    const handler = mockHandlers.get(IpcChannels.AUDIO_CAPTURE_ERROR)!;
    handler({}, 'Device disconnected');

    // Should be able to start again (not throw "already active")
    expect(() => startCapture(vi.fn(), vi.fn())).not.toThrow();
    stopCapture();
  });

  it('AUDIO_CAPTURE_ERROR handler is a no-op when not capturing', () => {
    registerAudioIpc();
    const handler = mockHandlers.get(IpcChannels.AUDIO_CAPTURE_ERROR)!;

    // Should not throw
    expect(() => handler({}, 'some error')).not.toThrow();
  });
});
