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
  MockSonioxClient,
  mockFlashTrayIcon,
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
    onShow: 'fresh' as string,
    sonioxApiKey: 'test-key',
    sonioxModel: 'stt-rt-preview',
    language: 'en',
    maxEndpointDelayMs: 1000,
  };

  const mockShowOverlay = vi.fn();
  const mockHideOverlay = vi.fn();
  const mockFlashTrayIcon = vi.fn();

  return {
    mockIpcMainHandlers,
    mockOverlayWindow,
    mockSonioxInstance,
    mockAudio,
    mockClipboard,
    mockSettingsData,
    mockShowOverlay,
    mockHideOverlay,
    MockSonioxClient,
    mockFlashTrayIcon,
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
  shell: { openExternal: vi.fn() },
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
  showSettings: vi.fn(),
  setOverlayCloseHandler: vi.fn(),
}));

// --- Mock settings ---
vi.mock('./settings', () => ({
  getSettings: () => ({ ...mockSettingsData }),
}));

// --- Mock tray ---
vi.mock('./tray', () => ({
  flashTrayIcon: (...args: unknown[]) => mockFlashTrayIcon(...args),
}));

vi.mock('./logger');

import { initSessionManager, requestToggle, requestQuickDismiss } from './session';
import { IpcChannels } from '../shared/ipc';

// --- Helpers ---

function triggerOnConnected() {
  mockSonioxInstance.connected = true;
  mockSonioxInstance._events.onConnected?.();
}

function triggerOnFinished() {
  mockSonioxInstance._events.onFinished?.();
}

function triggerOnFinalTokens(tokens: unknown[]) {
  mockSonioxInstance._events.onFinalTokens?.(tokens);
}

function triggerOnNonFinalTokens(tokens: unknown[]) {
  mockSonioxInstance._events.onNonFinalTokens?.(tokens);
}

function triggerOnDisconnected(reason: string) {
  mockSonioxInstance._events.onDisconnected?.(1006, reason);
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

function triggerEscapeHideIpc() {
  const handler = mockIpcMainHandlers.get(IpcChannels.WINDOW_ESCAPE_HIDE);
  handler?.();
}

describe('Session Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIpcMainHandlers.clear();
    mockOverlayWindow.isVisible.mockReturnValue(false);
    mockOverlayWindow.isDestroyed.mockReturnValue(false);
    mockOverlayWindow.webContents.send.mockClear();
    mockSonioxInstance._events = {};
    mockSonioxInstance.connected = false;
    mockSettingsData.onHide = 'clipboard';
    mockSettingsData.onShow = 'fresh';
    mockSettingsData.sonioxApiKey = 'test-key';

    initSessionManager();
  });

  describe('initSessionManager', () => {
    it('registers IPC handlers for pause and resume', () => {
      expect(mockIpcMainHandlers.has(IpcChannels.SESSION_REQUEST_PAUSE)).toBe(true);
      expect(mockIpcMainHandlers.has(IpcChannels.SESSION_REQUEST_RESUME)).toBe(true);
    });
  });

  describe('requestToggle — show and start', () => {
    it('shows overlay and starts session when window is hidden', () => {
      mockOverlayWindow.isVisible.mockReturnValue(false);

      requestToggle();

      expect(mockShowOverlay).toHaveBeenCalled();
    });

    it('sends SESSION_START IPC with onShow value on start', () => {
      mockOverlayWindow.isVisible.mockReturnValue(false);

      requestToggle();

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(IpcChannels.SESSION_START, 'fresh');
    });

    it('sends connecting status on start', () => {
      mockOverlayWindow.isVisible.mockReturnValue(false);

      requestToggle();

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
        IpcChannels.SESSION_STATUS,
        'connecting',
      );
    });

    it('connects SonioxClient with settings', () => {
      mockOverlayWindow.isVisible.mockReturnValue(false);

      requestToggle();

      expect(mockSonioxInstance.connect).toHaveBeenCalledWith(
        expect.objectContaining({ sonioxApiKey: 'test-key' }),
      );
    });

    it('starts audio capture only after WebSocket connects', () => {
      mockOverlayWindow.isVisible.mockReturnValue(false);

      requestToggle();

      // Audio should NOT start yet — still connecting
      expect(mockAudio.startCapture).not.toHaveBeenCalled();

      // Simulate WebSocket open
      triggerOnConnected();

      expect(mockAudio.startCapture).toHaveBeenCalled();
    });

    it('transitions to recording after WebSocket connects', () => {
      mockOverlayWindow.isVisible.mockReturnValue(false);

      requestToggle();
      triggerOnConnected();

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
        IpcChannels.SESSION_STATUS,
        'recording',
      );
    });
  });

  describe('token forwarding', () => {
    beforeEach(() => {
      mockOverlayWindow.isVisible.mockReturnValue(false);
      requestToggle();
      triggerOnConnected();
      mockOverlayWindow.webContents.send.mockClear();
    });

    it('forwards final tokens to renderer', () => {
      const tokens = [{ text: 'hello', is_final: true }];
      triggerOnFinalTokens(tokens);

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
        IpcChannels.TOKENS_FINAL,
        tokens,
      );
    });

    it('forwards non-final tokens to renderer', () => {
      const tokens = [{ text: 'hel', is_final: false }];
      triggerOnNonFinalTokens(tokens);

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
        IpcChannels.TOKENS_NONFINAL,
        tokens,
      );
    });
  });

  describe('audio data piping', () => {
    it('pipes audio chunks to SonioxClient', () => {
      mockOverlayWindow.isVisible.mockReturnValue(false);
      requestToggle();
      triggerOnConnected();

      // Get the onData callback that was passed to startCapture
      const onData = mockAudio.startCapture.mock.calls[0][0] as (chunk: Buffer) => void;
      const chunk = Buffer.from([0x01, 0x02]);
      onData(chunk);

      expect(mockSonioxInstance.sendAudio).toHaveBeenCalledWith(chunk);
    });
  });

  describe('pause', () => {
    beforeEach(() => {
      mockOverlayWindow.isVisible.mockReturnValue(false);
      requestToggle();
      triggerOnConnected();
      mockOverlayWindow.webContents.send.mockClear();
    });

    it('stops audio capture on pause', () => {
      triggerPauseIpc();

      expect(mockAudio.stopCapture).toHaveBeenCalled();
    });

    it('sends finalize to Soniox on pause', () => {
      triggerPauseIpc();

      expect(mockSonioxInstance.finalize).toHaveBeenCalled();
    });

    it('waits for finalization before sending SESSION_PAUSED IPC', async () => {
      triggerPauseIpc();

      // Should NOT have sent SESSION_PAUSED yet (finalization pending)
      expect(mockOverlayWindow.webContents.send).not.toHaveBeenCalledWith(
        IpcChannels.SESSION_PAUSED,
      );

      // Complete finalization
      triggerOnFinished();

      await vi.waitFor(() => {
        expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
          IpcChannels.SESSION_PAUSED,
        );
      });
    });

    it('sends SESSION_PAUSED IPC after finalization', async () => {
      triggerPauseIpc();
      triggerOnFinished();

      await vi.waitFor(() => {
        expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
          IpcChannels.SESSION_PAUSED,
        );
      });
    });

    it('clears ghost text on pause by sending empty non-final tokens', async () => {
      triggerPauseIpc();
      triggerOnFinished();

      await vi.waitFor(() => {
        expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
          IpcChannels.TOKENS_NONFINAL,
          [],
        );
      });
    });

    it('does not disconnect WebSocket on pause', async () => {
      triggerPauseIpc();
      triggerOnFinished();

      await vi.waitFor(() => {
        expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
          IpcChannels.SESSION_PAUSED,
        );
      });

      expect(mockSonioxInstance.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('resume', () => {
    beforeEach(async () => {
      mockOverlayWindow.isVisible.mockReturnValue(false);
      requestToggle();
      triggerOnConnected();
      // Pause first
      triggerPauseIpc();
      triggerOnFinished();
      await vi.waitFor(() => {
        expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
          IpcChannels.SESSION_PAUSED,
        );
      });
      mockOverlayWindow.webContents.send.mockClear();
      mockAudio.startCapture.mockClear();
    });

    it('restarts audio capture on resume', () => {
      triggerResumeIpc();

      expect(mockAudio.startCapture).toHaveBeenCalled();
    });

    it('sends SESSION_RESUMED IPC', () => {
      triggerResumeIpc();

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
        IpcChannels.SESSION_RESUMED,
      );
    });

    it('transitions to recording status', () => {
      triggerResumeIpc();

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
        IpcChannels.SESSION_STATUS,
        'recording',
      );
    });
  });

  describe('stop', () => {
    beforeEach(() => {
      mockOverlayWindow.isVisible.mockReturnValue(false);
      requestToggle();
      triggerOnConnected();
      mockOverlayWindow.webContents.send.mockClear();
      // Now the overlay is "visible" for toggle purposes
      mockOverlayWindow.isVisible.mockReturnValue(true);
    });

    it('transitions to finalizing on stop', () => {
      requestToggle(); // toggle while visible → stop

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
        IpcChannels.SESSION_STATUS,
        'finalizing',
      );
    });

    it('stops audio capture on stop', () => {
      requestToggle();

      expect(mockAudio.stopCapture).toHaveBeenCalled();
    });

    it('sends finalize to Soniox on stop', () => {
      requestToggle();

      expect(mockSonioxInstance.finalize).toHaveBeenCalled();
    });

    it('waits for finalization then sends SESSION_STOP', async () => {
      requestToggle();

      // Should not have sent stop yet
      expect(mockOverlayWindow.webContents.send).not.toHaveBeenCalledWith(
        IpcChannels.SESSION_STOP,
      );

      triggerOnFinished();

      await vi.waitFor(() => {
        expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
          IpcChannels.SESSION_STOP,
        );
      });
    });

    it('clears ghost text on stop', async () => {
      requestToggle();
      triggerOnFinished();

      await vi.waitFor(() => {
        expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
          IpcChannels.TOKENS_NONFINAL,
          [],
        );
      });
    });

    it('disconnects WebSocket after finalization', async () => {
      mockSettingsData.onHide = 'none'; // skip clipboard wait
      requestToggle();
      triggerOnFinished();

      await vi.waitFor(() => {
        expect(mockSonioxInstance.disconnect).toHaveBeenCalled();
      });
    });

    it('hides overlay after finalization', async () => {
      mockSettingsData.onHide = 'none';
      requestToggle();
      triggerOnFinished();

      await vi.waitFor(() => {
        expect(mockHideOverlay).toHaveBeenCalled();
      });
    });

    it('transitions to idle after stop completes', async () => {
      mockSettingsData.onHide = 'none';
      requestToggle();
      triggerOnFinished();

      await vi.waitFor(() => {
        expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
          IpcChannels.SESSION_STATUS,
          'idle',
        );
      });
    });
  });

  describe('stop from paused state', () => {
    beforeEach(async () => {
      mockOverlayWindow.isVisible.mockReturnValue(false);
      requestToggle();
      triggerOnConnected();
      triggerPauseIpc();
      triggerOnFinished();
      await vi.waitFor(() => {
        expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
          IpcChannels.SESSION_PAUSED,
        );
      });
      mockOverlayWindow.webContents.send.mockClear();
      mockSonioxInstance.finalize.mockClear();
      mockSonioxInstance.disconnect.mockClear();
      mockHideOverlay.mockClear();
      mockOverlayWindow.isVisible.mockReturnValue(true);
    });

    it('stops cleanly from paused state', async () => {
      mockSettingsData.onHide = 'none'; // skip clipboard wait
      requestToggle();
      triggerOnFinished();

      await vi.waitFor(() => {
        expect(mockSonioxInstance.disconnect).toHaveBeenCalled();
        expect(mockHideOverlay).toHaveBeenCalled();
      });
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      mockOverlayWindow.isVisible.mockReturnValue(false);
      requestToggle();
      triggerOnConnected();
      mockOverlayWindow.webContents.send.mockClear();
    });

    it('transitions to reconnecting on WebSocket disconnect', () => {
      triggerOnDisconnected('connection lost');

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
        IpcChannels.SESSION_STATUS,
        'reconnecting',
      );
    });

    it('stops audio capture on disconnect', () => {
      triggerOnDisconnected('connection lost');

      expect(mockAudio.stopCapture).toHaveBeenCalled();
    });

    it('transitions to error on WebSocket error', () => {
      triggerOnError(new Error('connection failed'));

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
        IpcChannels.SESSION_STATUS,
        'error',
      );
    });
  });

  describe('guard: no duplicate starts', () => {
    it('does not start a second session while already active', () => {
      mockOverlayWindow.isVisible.mockReturnValue(false);
      requestToggle();
      triggerOnConnected();

      // Try to start again
      mockOverlayWindow.isVisible.mockReturnValue(false);
      mockSonioxInstance.connect.mockClear();
      requestToggle();

      // startSession is a no-op since status is not idle
      expect(mockSonioxInstance.connect).not.toHaveBeenCalled();
    });
  });

  describe('guard: pause only when recording', () => {
    it('pause is a no-op when idle', () => {
      triggerPauseIpc();

      expect(mockAudio.stopCapture).not.toHaveBeenCalled();
      expect(mockSonioxInstance.finalize).not.toHaveBeenCalled();
    });
  });

  describe('guard: resume only when paused', () => {
    it('resume is a no-op when recording', () => {
      mockOverlayWindow.isVisible.mockReturnValue(false);
      requestToggle();
      triggerOnConnected();
      mockAudio.startCapture.mockClear();

      triggerResumeIpc();

      // startCapture should NOT be called again
      expect(mockAudio.startCapture).not.toHaveBeenCalled();
    });
  });

  describe('finalization timeout', () => {
    it('proceeds after timeout if finalization never completes', async () => {
      vi.useFakeTimers();

      mockSettingsData.onHide = 'none'; // skip clipboard wait
      mockOverlayWindow.isVisible.mockReturnValue(false);
      requestToggle();
      triggerOnConnected();
      mockOverlayWindow.isVisible.mockReturnValue(true);
      mockOverlayWindow.webContents.send.mockClear();

      requestToggle(); // stop

      // Don't trigger onFinished — simulate timeout
      await vi.advanceTimersByTimeAsync(5000);

      expect(mockHideOverlay).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('API key guard', () => {
    it('shows overlay and sends no-api-key error when API key is empty', () => {
      mockSettingsData.sonioxApiKey = '';
      mockOverlayWindow.isVisible.mockReturnValue(false);

      requestToggle();

      expect(mockShowOverlay).toHaveBeenCalled();
      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
        IpcChannels.SESSION_ERROR,
        expect.objectContaining({
          type: 'no-api-key',
          message: 'Set up your API key in Settings to start transcribing',
        }),
      );
    });

    it('does not start session when API key is empty', () => {
      mockSettingsData.sonioxApiKey = '';
      mockOverlayWindow.isVisible.mockReturnValue(false);

      requestToggle();

      expect(mockSonioxInstance.connect).not.toHaveBeenCalled();
      expect(mockAudio.startCapture).not.toHaveBeenCalled();
    });

    it('sends open-settings action in no-api-key error', () => {
      mockSettingsData.sonioxApiKey = '';
      mockOverlayWindow.isVisible.mockReturnValue(false);

      requestToggle();

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
        IpcChannels.SESSION_ERROR,
        expect.objectContaining({
          action: { label: 'Open Settings', action: 'open-settings' },
        }),
      );
    });

    it('clears error when starting session with valid API key', () => {
      mockSettingsData.sonioxApiKey = 'test-key';
      mockOverlayWindow.isVisible.mockReturnValue(false);

      requestToggle();

      // clearError sends null via SESSION_ERROR before session start
      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
        IpcChannels.SESSION_ERROR,
        null,
      );
    });

    it('hides overlay on second toggle when shown without API key', () => {
      mockSettingsData.sonioxApiKey = '';
      mockOverlayWindow.isVisible.mockReturnValue(false);

      requestToggle(); // shows overlay with error

      // Now overlay is "visible"
      mockOverlayWindow.isVisible.mockReturnValue(true);
      mockHideOverlay.mockClear();

      requestToggle(); // should hide (status is idle)

      expect(mockHideOverlay).toHaveBeenCalled();
    });
  });

  describe('requestQuickDismiss', () => {
    beforeEach(() => {
      mockOverlayWindow.isVisible.mockReturnValue(false);
      requestToggle();
      triggerOnConnected();
      mockOverlayWindow.webContents.send.mockClear();
      mockAudio.stopCapture.mockClear();
    });

    it('stops capture and hides without finalization', () => {
      requestQuickDismiss();

      expect(mockAudio.stopCapture).toHaveBeenCalled();
      expect(mockSonioxInstance.finalize).not.toHaveBeenCalled();
      expect(mockSonioxInstance.disconnect).toHaveBeenCalled();
      expect(mockHideOverlay).toHaveBeenCalled();
    });

    it('sends idle status', () => {
      requestQuickDismiss();

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
        IpcChannels.SESSION_STATUS,
        'idle',
      );
    });

    it('clears ghost text', () => {
      requestQuickDismiss();

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
        IpcChannels.TOKENS_NONFINAL,
        [],
      );
    });

    it('does not write to clipboard', () => {
      requestQuickDismiss();

      expect(mockClipboard.writeText).not.toHaveBeenCalled();
      // SESSION_TEXT should not be sent to renderer
      const sendCalls = mockOverlayWindow.webContents.send.mock.calls;
      const sessionTextCalls = sendCalls.filter(
        (call: unknown[]) => call[0] === IpcChannels.SESSION_TEXT,
      );
      expect(sessionTextCalls).toHaveLength(0);
    });

    it('is no-op during active transition', () => {
      mockOverlayWindow.isVisible.mockReturnValue(true);
      requestToggle(); // starts async stopSession, sets activeTransition
      mockHideOverlay.mockClear();

      requestQuickDismiss();

      // hideOverlay should not be called by quickDismiss
      expect(mockHideOverlay).not.toHaveBeenCalled();
    });

    it('hides even when status is idle', () => {
      mockSettingsData.onHide = 'none';
      mockOverlayWindow.isVisible.mockReturnValue(true);
      // Stop the session first to get to idle
      requestToggle();
      triggerOnFinished();

      // Wait for stop to complete and reset
      return vi.waitFor(() => {
        expect(mockHideOverlay).toHaveBeenCalled();
      }).then(() => {
        mockHideOverlay.mockClear();
        requestQuickDismiss();
        expect(mockHideOverlay).toHaveBeenCalled();
      });
    });
  });

  describe('WINDOW_ESCAPE_HIDE IPC', () => {
    it('registers handler for WINDOW_ESCAPE_HIDE', () => {
      expect(mockIpcMainHandlers.has(IpcChannels.WINDOW_ESCAPE_HIDE)).toBe(true);
    });

    it('routes to quick dismiss path', () => {
      mockOverlayWindow.isVisible.mockReturnValue(false);
      requestToggle();
      triggerOnConnected();
      mockAudio.stopCapture.mockClear();
      mockHideOverlay.mockClear();

      triggerEscapeHideIpc();

      expect(mockAudio.stopCapture).toHaveBeenCalled();
      expect(mockSonioxInstance.finalize).not.toHaveBeenCalled();
      expect(mockHideOverlay).toHaveBeenCalled();
    });
  });

  describe('tray flash on clipboard copy', () => {
    beforeEach(() => {
      mockOverlayWindow.isVisible.mockReturnValue(false);
      requestToggle();
      triggerOnConnected();
      mockOverlayWindow.webContents.send.mockClear();
      mockOverlayWindow.isVisible.mockReturnValue(true);
    });

    it('calls flashTrayIcon on successful clipboard copy', async () => {
      requestToggle(); // stop
      triggerOnFinished();

      // Wait for clipboard text handler to be registered
      await vi.waitFor(() => {
        expect(mockIpcMainHandlers.has(IpcChannels.SESSION_TEXT)).toBe(true);
      });

      // Simulate renderer sending text back
      const textHandler = mockIpcMainHandlers.get(IpcChannels.SESSION_TEXT)!;
      textHandler({}, 'hello world');

      await vi.waitFor(() => {
        expect(mockFlashTrayIcon).toHaveBeenCalled();
      });
    });

    it('skips flashTrayIcon when editor is empty', async () => {
      requestToggle(); // stop
      triggerOnFinished();

      await vi.waitFor(() => {
        expect(mockIpcMainHandlers.has(IpcChannels.SESSION_TEXT)).toBe(true);
      });

      // Simulate renderer sending empty text
      const textHandler = mockIpcMainHandlers.get(IpcChannels.SESSION_TEXT)!;
      textHandler({}, '');

      await vi.waitFor(() => {
        expect(mockHideOverlay).toHaveBeenCalled();
      });

      expect(mockFlashTrayIcon).not.toHaveBeenCalled();
    });
  });

  describe('SESSION_START includes onShow value', () => {
    it('sends onShow: fresh by default', () => {
      mockOverlayWindow.isVisible.mockReturnValue(false);
      requestToggle();

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
        IpcChannels.SESSION_START,
        'fresh',
      );
    });

    it('sends onShow: append when configured', () => {
      mockSettingsData.onShow = 'append';
      mockOverlayWindow.isVisible.mockReturnValue(false);
      requestToggle();

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(
        IpcChannels.SESSION_START,
        'append',
      );
    });
  });
});
