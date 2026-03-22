import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Hoisted mocks ---

const {
  mockIpcMainHandlers,
  mockOverlayWindow,
  mockSonioxInstance,
  mockAudio,
  mockClipboard,
  mockSettingsData,
  mockShowOverlay,
  mockHideOverlay,
  mockShowSettings,
  MockSonioxClient,
  mockShell,
} = vi.hoisted(() => {
  const mockIpcMainHandlers = new Map<string, (...args: unknown[]) => void>();

  const mockWebContents = { send: vi.fn() };
  const mockOverlayWindow = {
    webContents: mockWebContents,
    isDestroyed: vi.fn(() => false),
    isVisible: vi.fn(() => false),
  };

  const mockSonioxInstance = {
    connect: vi.fn(),
    sendAudio: vi.fn(),
    finalize: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
    _events: {} as Record<string, (...args: unknown[]) => void>,
  };

  class MockSonioxClient {
    constructor(events: Record<string, (...args: unknown[]) => void>) {
      mockSonioxInstance._events = events;
      mockSonioxInstance.connect.mockClear();
      mockSonioxInstance.sendAudio.mockClear();
      mockSonioxInstance.finalize.mockClear();
      mockSonioxInstance.disconnect.mockClear();
      mockSonioxInstance.connected = false;
    }
    get connected() { return mockSonioxInstance.connected; }
    connect(...args: unknown[]) { return mockSonioxInstance.connect(...args); }
    sendAudio(...args: unknown[]) { return mockSonioxInstance.sendAudio(...args); }
    finalize(...args: unknown[]) { return mockSonioxInstance.finalize(...args); }
    disconnect(...args: unknown[]) { return mockSonioxInstance.disconnect(...args); }
  }

  const mockAudio = {
    startCapture: vi.fn(),
    stopCapture: vi.fn(),
  };

  const mockClipboard = {
    writeText: vi.fn(),
  };

  const mockSettingsData = {
    onHide: 'clipboard' as string,
    sonioxApiKey: 'test-key',
    sonioxModel: 'stt-rt-preview',
    language: 'en',
    maxEndpointDelayMs: 1000,
  };

  const mockShowOverlay = vi.fn();
  const mockHideOverlay = vi.fn();
  const mockShowSettings = vi.fn();

  const mockShell = {
    openExternal: vi.fn(),
  };

  return {
    mockIpcMainHandlers,
    mockOverlayWindow,
    mockSonioxInstance,
    mockAudio,
    mockClipboard,
    mockSettingsData,
    mockShowOverlay,
    mockHideOverlay,
    mockShowSettings,
    MockSonioxClient,
    mockShell,
  };
});

// --- Mock electron ---
vi.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, handler: (...args: unknown[]) => void) => {
      mockIpcMainHandlers.set(channel, handler);
    },
    once: (channel: string, handler: (...args: unknown[]) => void) => {
      mockIpcMainHandlers.set(channel, handler);
    },
    removeListener: (channel: string, _handler: (...args: unknown[]) => void) => {
      mockIpcMainHandlers.delete(channel);
    },
  },
  clipboard: mockClipboard,
  shell: mockShell,
}));

// --- Mock SonioxClient ---
vi.mock('./soniox', () => ({
  SonioxClient: MockSonioxClient,
}));

// --- Mock audio ---
vi.mock('./audio', () => ({
  startCapture: (...args: unknown[]) => mockAudio.startCapture(...args),
  stopCapture: () => mockAudio.stopCapture(),
}));

// --- Mock window ---
vi.mock('./window', () => ({
  getOverlayWindow: () => mockOverlayWindow,
  showOverlay: (...args: unknown[]) => mockShowOverlay(...args),
  hideOverlay: (...args: unknown[]) => mockHideOverlay(...args),
  showSettings: (...args: unknown[]) => mockShowSettings(...args),
  setOverlayCloseHandler: vi.fn(),
}));

// --- Mock settings ---
vi.mock('./settings', () => ({
  getSettings: () => ({ ...mockSettingsData }),
}));

import { initSessionManager, requestToggle } from './session';
import { IpcChannels } from '../shared/ipc';

// --- Helpers ---

function triggerOnConnected() {
  mockSonioxInstance.connected = true;
  mockSonioxInstance._events.onConnected?.();
}

function triggerOnDisconnected(code: number, reason: string) {
  mockSonioxInstance.connected = false;
  mockSonioxInstance._events.onDisconnected?.(code, reason);
}

function triggerOnError(err: Error) {
  mockSonioxInstance._events.onError?.(err);
}

function triggerPauseIpc() {
  const handler = mockIpcMainHandlers.get(IpcChannels.SESSION_REQUEST_PAUSE);
  handler?.();
}

function triggerResumeIpc() {
  const handler = mockIpcMainHandlers.get(IpcChannels.SESSION_REQUEST_RESUME);
  handler?.();
}

function triggerDismissError() {
  const handler = mockIpcMainHandlers.get(IpcChannels.SESSION_DISMISS_ERROR);
  handler?.();
}

function triggerOpenSettings() {
  const handler = mockIpcMainHandlers.get(IpcChannels.SESSION_OPEN_SETTINGS);
  handler?.();
}

function triggerOpenMicSettings() {
  const handler = mockIpcMainHandlers.get(IpcChannels.SESSION_OPEN_MIC_SETTINGS);
  handler?.();
}

function startAndConnect() {
  mockOverlayWindow.isVisible.mockReturnValue(false);
  requestToggle();
  triggerOnConnected();
  mockOverlayWindow.webContents.send.mockClear();
}

function getSendCalls(channel: string): unknown[][] {
  return mockOverlayWindow.webContents.send.mock.calls
    .filter((call: unknown[]) => call[0] === channel);
}

describe('Session Manager — Error Handling & Reconnection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockIpcMainHandlers.clear();
    mockOverlayWindow.isVisible.mockReturnValue(false);
    mockOverlayWindow.isDestroyed.mockReturnValue(false);
    mockOverlayWindow.webContents.send.mockClear();
    mockSonioxInstance._events = {};
    mockSonioxInstance.connected = false;
    mockSettingsData.onHide = 'clipboard';
    mockSettingsData.sonioxApiKey = 'test-key';

    initSessionManager();
  });

  describe('IPC handlers registration', () => {
    it('registers dismiss-error handler', () => {
      expect(mockIpcMainHandlers.has(IpcChannels.SESSION_DISMISS_ERROR)).toBe(true);
    });

    it('registers open-settings handler', () => {
      expect(mockIpcMainHandlers.has(IpcChannels.SESSION_OPEN_SETTINGS)).toBe(true);
    });

    it('registers open-mic-settings handler', () => {
      expect(mockIpcMainHandlers.has(IpcChannels.SESSION_OPEN_MIC_SETTINGS)).toBe(true);
    });
  });

  describe('WebSocket disconnect — reconnectable', () => {
    beforeEach(() => {
      startAndConnect();
    });

    it('stops audio capture on disconnect', () => {
      triggerOnDisconnected(1006, 'connection lost');
      expect(mockAudio.stopCapture).toHaveBeenCalled();
    });

    it('transitions to reconnecting on network disconnect', () => {
      triggerOnDisconnected(1006, 'connection lost');
      // scheduleReconnect() immediately sets status to 'reconnecting'
      const statusCalls = getSendCalls(IpcChannels.SESSION_STATUS);
      expect(statusCalls.some((call) => call[1] === 'reconnecting')).toBe(true);
    });

    it('sends error info on disconnect', () => {
      triggerOnDisconnected(1006, 'connection lost');
      const errorCalls = getSendCalls(IpcChannels.SESSION_ERROR);
      expect(errorCalls.length).toBeGreaterThan(0);
      expect(errorCalls[0][1]).toEqual(expect.objectContaining({
        type: 'network',
        message: 'Connection lost',
      }));
    });

    it('attempts reconnect after delay', () => {
      triggerOnDisconnected(1006, 'connection lost');
      mockSonioxInstance.connect.mockClear();

      vi.advanceTimersByTime(1000);

      expect(mockSonioxInstance.connect).toHaveBeenCalled();
    });
  });

  describe('exponential backoff', () => {
    beforeEach(() => {
      startAndConnect();
    });

    it('increases delay on repeated failures', () => {
      // First disconnect → schedules at 1s
      triggerOnDisconnected(1006, 'connection lost');
      mockSonioxInstance.connect.mockClear();

      // Advance 1s → first reconnect attempt
      vi.advanceTimersByTime(1000);
      expect(mockSonioxInstance.connect).toHaveBeenCalledTimes(1);

      // That attempt fails too
      triggerOnDisconnected(1006, 'connection lost');
      mockSonioxInstance.connect.mockClear();

      // Should NOT reconnect at 1s (delay is now 2s)
      vi.advanceTimersByTime(1000);
      expect(mockSonioxInstance.connect).not.toHaveBeenCalled();

      // Should reconnect at 2s
      vi.advanceTimersByTime(1000);
      expect(mockSonioxInstance.connect).toHaveBeenCalledTimes(1);
    });

    it('caps delay at 30 seconds', () => {
      // Simulate many failures to exceed cap
      triggerOnDisconnected(1006, 'lost');
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(30000); // advance max
        triggerOnDisconnected(1006, 'lost');
      }

      mockSonioxInstance.connect.mockClear();
      mockOverlayWindow.webContents.send.mockClear();

      // After many failures, delay should be capped at 30s
      vi.advanceTimersByTime(29999);
      expect(mockSonioxInstance.connect).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(mockSonioxInstance.connect).toHaveBeenCalled();
    });
  });

  describe('successful reconnect', () => {
    beforeEach(() => {
      startAndConnect();
    });

    it('sets status to paused on successful reconnect', () => {
      triggerOnDisconnected(1006, 'connection lost');

      vi.advanceTimersByTime(1000);
      // Simulate successful reconnect
      triggerOnConnected();

      const statusCalls = getSendCalls(IpcChannels.SESSION_STATUS);
      expect(statusCalls.pop()?.[1]).toBe('paused');
    });

    it('does not start audio capture on reconnect', () => {
      triggerOnDisconnected(1006, 'connection lost');
      mockAudio.startCapture.mockClear();

      vi.advanceTimersByTime(1000);
      triggerOnConnected();

      expect(mockAudio.startCapture).not.toHaveBeenCalled();
    });

    it('allows user to resume after reconnect', () => {
      triggerOnDisconnected(1006, 'connection lost');

      vi.advanceTimersByTime(1000);
      triggerOnConnected();
      mockAudio.startCapture.mockClear();
      mockOverlayWindow.webContents.send.mockClear();

      // User resumes
      triggerResumeIpc();

      expect(mockAudio.startCapture).toHaveBeenCalled();
      expect(getSendCalls(IpcChannels.SESSION_STATUS).pop()?.[1]).toBe('recording');
    });
  });

  describe('non-reconnectable errors', () => {
    beforeEach(() => {
      startAndConnect();
    });

    it('does not reconnect on API key error', () => {
      triggerOnDisconnected(4001, 'invalid api key');
      mockSonioxInstance.connect.mockClear();

      vi.advanceTimersByTime(60000);
      expect(mockSonioxInstance.connect).not.toHaveBeenCalled();
    });

    it('sets status to error on API key error', () => {
      triggerOnDisconnected(4001, 'invalid api key');
      expect(getSendCalls(IpcChannels.SESSION_STATUS).pop()?.[1]).toBe('error');
    });

    it('sends API key error info with Open Settings action', () => {
      triggerOnDisconnected(4001, 'invalid api key');
      const errorCalls = getSendCalls(IpcChannels.SESSION_ERROR);
      expect(errorCalls.length).toBeGreaterThan(0);
      expect(errorCalls[0][1]).toEqual(expect.objectContaining({
        type: 'api-key',
        action: expect.objectContaining({ label: 'Open Settings' }),
      }));
    });

    it('does not reconnect on rate limit error', () => {
      triggerOnDisconnected(4029, 'rate limit exceeded');
      mockSonioxInstance.connect.mockClear();

      vi.advanceTimersByTime(60000);
      expect(mockSonioxInstance.connect).not.toHaveBeenCalled();
    });

    it('sends rate limit error info', () => {
      triggerOnDisconnected(4029, 'rate limit exceeded');
      const errorCalls = getSendCalls(IpcChannels.SESSION_ERROR);
      expect(errorCalls.length).toBeGreaterThan(0);
      expect(errorCalls[0][1]).toEqual(expect.objectContaining({
        type: 'rate-limit',
      }));
    });
  });

  describe('audio errors', () => {
    it('sends mic-denied error with action', () => {
      mockOverlayWindow.isVisible.mockReturnValue(false);
      mockAudio.startCapture.mockImplementation(() => {
        throw new Error('Microphone access denied');
      });

      requestToggle();
      triggerOnConnected();

      const errorCalls = getSendCalls(IpcChannels.SESSION_ERROR);
      expect(errorCalls.length).toBeGreaterThan(0);
      expect(errorCalls[0][1]).toEqual(expect.objectContaining({
        type: 'mic-denied',
        action: expect.objectContaining({
          label: 'Grant access in Windows Settings',
          action: 'open-mic-settings',
        }),
      }));
    });

    it('sends mic-unavailable error for device not found', () => {
      mockOverlayWindow.isVisible.mockReturnValue(false);
      mockAudio.startCapture.mockImplementation(() => {
        throw new Error('Audio device not found: MyMic');
      });

      requestToggle();
      triggerOnConnected();

      const errorCalls = getSendCalls(IpcChannels.SESSION_ERROR);
      expect(errorCalls.length).toBeGreaterThan(0);
      expect(errorCalls[0][1]).toEqual(expect.objectContaining({
        type: 'mic-unavailable',
      }));
    });
  });

  describe('cancel reconnect', () => {
    it('cancels reconnect when session is stopped', () => {
      startAndConnect();
      triggerOnDisconnected(1006, 'connection lost');
      mockSonioxInstance.connect.mockClear();

      // Stop session by toggling while visible
      mockOverlayWindow.isVisible.mockReturnValue(true);
      requestToggle();

      // Advance past reconnect timer
      vi.advanceTimersByTime(60000);
      expect(mockSonioxInstance.connect).not.toHaveBeenCalled();
    });
  });

  describe('error action IPC', () => {
    it('opens settings window on open-settings action', () => {
      triggerOpenSettings();
      expect(mockShowSettings).toHaveBeenCalled();
    });

    it('opens Windows mic settings on open-mic-settings action', () => {
      triggerOpenMicSettings();
      expect(mockShell.openExternal).toHaveBeenCalledWith('ms-settings:privacy-microphone');
    });

    it('dismiss error resets status to idle when not reconnecting', () => {
      startAndConnect();
      // Simulate a non-reconnectable error
      triggerOnDisconnected(4001, 'invalid api key');
      mockOverlayWindow.webContents.send.mockClear();

      triggerDismissError();

      expect(getSendCalls(IpcChannels.SESSION_STATUS).pop()?.[1]).toBe('idle');
    });
  });

  describe('pause/resume guard during error states', () => {
    beforeEach(() => {
      startAndConnect();
    });

    it('pause is a no-op during disconnected state', () => {
      triggerOnDisconnected(1006, 'connection lost');
      mockAudio.stopCapture.mockClear();

      triggerPauseIpc();

      // stopCapture should NOT be called again
      expect(mockAudio.stopCapture).not.toHaveBeenCalled();
    });

    it('resume is a no-op during reconnecting state', () => {
      triggerOnDisconnected(1006, 'connection lost');

      // Advance to reconnecting
      vi.advanceTimersByTime(1000);
      mockAudio.startCapture.mockClear();

      triggerResumeIpc();

      expect(mockAudio.startCapture).not.toHaveBeenCalled();
    });
  });
});
