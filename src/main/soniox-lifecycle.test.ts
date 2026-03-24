import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Hoisted mocks ---

const { mockSonioxInstance, MockSonioxClient, mockAudio, mockSettingsData } = vi.hoisted(() => {
  const mockSonioxInstance = {
    connect: vi.fn(),
    sendAudio: vi.fn(),
    finalize: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
    hasPendingNonFinalTokens: true,
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
    get hasPendingNonFinalTokens() { return mockSonioxInstance.hasPendingNonFinalTokens; }
    connect(...args: unknown[]) { return mockSonioxInstance.connect(...args); }
    sendAudio(...args: unknown[]) { return mockSonioxInstance.sendAudio(...args); }
    finalize(...args: unknown[]) { return mockSonioxInstance.finalize(...args); }
    disconnect(...args: unknown[]) { return mockSonioxInstance.disconnect(...args); }
  }

  const mockAudio = {
    startCapture: vi.fn(),
    stopCapture: vi.fn(),
  };

  const mockSettingsData = {
    sonioxApiKey: 'test-key',
    sonioxModel: 'stt-rt-preview',
    language: 'en',
    maxEndpointDelayMs: 1000,
  };

  return { mockSonioxInstance, MockSonioxClient, mockAudio, mockSettingsData };
});

vi.mock('./soniox', () => ({
  SonioxClient: MockSonioxClient,
}));

vi.mock('./audio', () => ({
  startCapture: (...args: unknown[]) => mockAudio.startCapture(...args),
  stopCapture: () => mockAudio.stopCapture(),
}));

vi.mock('./settings', () => ({
  getSettings: () => ({ ...mockSettingsData }),
}));

vi.mock('./error-classification', () => ({
  classifyAudioError: (err: Error) => ({ type: 'unknown', message: err.message }),
  classifyDisconnect: (_code: number, reason: string) => {
    if (reason.includes('api key')) {
      return { reconnectable: false, error: { type: 'api-key', message: 'Invalid API key' } };
    }
    return { reconnectable: true, error: { type: 'network', message: 'Connection lost' } };
  },
}));

vi.mock('./reconnect-policy', () => ({
  getReconnectDelay: (attempt: number) => Math.min(1000 * Math.pow(2, attempt), 30000),
}));

vi.mock('./logger');

import { connectSoniox, isConnected, finalizeSoniox, sendAudio, resumeCapture, cancelReconnect, resetLifecycle } from './soniox-lifecycle';

function createMockCallbacks() {
  return {
    onFinalTokens: vi.fn(),
    onNonFinalTokens: vi.fn(),
    onStatusChange: vi.fn(),
    onError: vi.fn(),
    onFinalizationComplete: vi.fn(),
    onAudioLevel: vi.fn(),
  };
}

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

function triggerOnFinished() {
  mockSonioxInstance._events.onFinished?.();
}

describe('soniox-lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSonioxInstance._events = {};
    mockSonioxInstance.connected = false;
    resetLifecycle();
  });

  describe('connectSoniox', () => {
    it('creates and connects a SonioxClient', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);

      expect(mockSonioxInstance.connect).toHaveBeenCalledWith(
        expect.objectContaining({ sonioxApiKey: 'test-key' }),
        undefined,
      );
    });

    it('reports connected after WebSocket connects', () => {
      connectSoniox(createMockCallbacks());
      expect(isConnected()).toBe(false);
      triggerOnConnected();
      expect(isConnected()).toBe(true);
    });

    it('starts audio capture on WebSocket connect', () => {
      connectSoniox(createMockCallbacks());
      triggerOnConnected();

      expect(mockAudio.startCapture).toHaveBeenCalled();
    });

    it('calls onStatusChange with recording after connect', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();

      expect(callbacks.onStatusChange).toHaveBeenCalledWith('recording');
    });

    it('forwards final tokens via callback', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();

      const tokens = [{ text: 'hello', is_final: true }];
      mockSonioxInstance._events.onFinalTokens?.(tokens);

      expect(callbacks.onFinalTokens).toHaveBeenCalledWith(tokens);
    });

    it('forwards non-final tokens via callback', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();

      const tokens = [{ text: 'hel', is_final: false }];
      mockSonioxInstance._events.onNonFinalTokens?.(tokens);

      expect(callbacks.onNonFinalTokens).toHaveBeenCalledWith(tokens);
    });

    it('calls onFinalizationComplete on finished', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();
      triggerOnFinished();

      expect(callbacks.onFinalizationComplete).toHaveBeenCalled();
    });
  });

  describe('narrow API', () => {
    beforeEach(() => {
      connectSoniox(createMockCallbacks());
      triggerOnConnected();
    });

    it('finalizeSoniox calls finalize on client', () => {
      finalizeSoniox();
      expect(mockSonioxInstance.finalize).toHaveBeenCalled();
    });

    it('sendAudio pipes chunk to client', () => {
      const chunk = Buffer.from([0x01, 0x02]);
      sendAudio(chunk);
      expect(mockSonioxInstance.sendAudio).toHaveBeenCalledWith(chunk);
    });

    it('resumeCapture restarts audio capture', () => {
      mockAudio.startCapture.mockClear();
      resumeCapture();
      expect(mockAudio.startCapture).toHaveBeenCalled();
    });

    it('resumeCapture throws and reports error on failure', () => {
      const callbacks = createMockCallbacks();
      resetLifecycle();
      connectSoniox(callbacks);
      triggerOnConnected();
      mockAudio.startCapture.mockImplementation(() => { throw new Error('No mic'); });

      expect(() => resumeCapture()).toThrow('No mic');
      expect(callbacks.onStatusChange).toHaveBeenCalledWith('error');
      expect(callbacks.onError).toHaveBeenCalledWith(expect.objectContaining({ type: 'unknown' }));
    });
  });

  describe('disconnect handling', () => {
    it('sets status to reconnecting on network disconnect', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();
      callbacks.onStatusChange.mockClear();

      triggerOnDisconnected(1006, 'connection lost');

      expect(callbacks.onStatusChange).toHaveBeenCalledWith('reconnecting');
    });

    it('sets status to error on non-reconnectable disconnect', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();
      callbacks.onStatusChange.mockClear();

      triggerOnDisconnected(4001, 'invalid api key');

      expect(callbacks.onStatusChange).toHaveBeenCalledWith('error');
    });

    it('stops audio capture on disconnect', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();
      mockAudio.stopCapture.mockClear();

      triggerOnDisconnected(1006, 'connection lost');

      expect(mockAudio.stopCapture).toHaveBeenCalled();
    });

    it('resets audio level to MIN_DB on disconnect', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();

      triggerOnDisconnected(1006, 'connection lost');

      expect(callbacks.onAudioLevel).toHaveBeenCalledWith(-60);
    });
  });

  describe('error handling', () => {
    it('sets error status on Soniox error', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();
      callbacks.onStatusChange.mockClear();

      triggerOnError(new Error('something broke'));

      expect(callbacks.onStatusChange).toHaveBeenCalledWith('error');
    });

    it('resets audio level to MIN_DB on Soniox error', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();

      triggerOnError(new Error('something broke'));

      expect(callbacks.onAudioLevel).toHaveBeenCalledWith(-60);
    });

    it('resets audio level to MIN_DB on audio capture error', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();

      const onAudioError = mockAudio.startCapture.mock.calls[0][1] as (err: Error) => void;
      onAudioError(new Error('mic unplugged'));

      expect(callbacks.onAudioLevel).toHaveBeenCalledWith(-60);
    });
  });

  describe('resetLifecycle', () => {
    it('disconnects client and clears reconnect state', () => {
      vi.useFakeTimers();

      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();
      triggerOnDisconnected(1006, 'connection lost');

      mockSonioxInstance.connect.mockClear();
      resetLifecycle();

      // Advance past any reconnect timer
      vi.advanceTimersByTime(60000);
      expect(mockSonioxInstance.connect).not.toHaveBeenCalled();
      expect(isConnected()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('cancelReconnect', () => {
    it('prevents pending reconnect from firing', () => {
      vi.useFakeTimers();

      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();
      triggerOnDisconnected(1006, 'connection lost');

      mockSonioxInstance.connect.mockClear();
      cancelReconnect();

      vi.advanceTimersByTime(60000);
      expect(mockSonioxInstance.connect).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('context support', () => {
    it('passes contextText to SonioxClient.connect', () => {
      connectSoniox(createMockCallbacks(), 'hello world');

      expect(mockSonioxInstance.connect).toHaveBeenCalledWith(
        expect.objectContaining({ sonioxApiKey: 'test-key' }),
        'hello world',
      );
    });

    it('passes undefined when no contextText provided', () => {
      connectSoniox(createMockCallbacks());

      expect(mockSonioxInstance.connect).toHaveBeenCalledWith(
        expect.objectContaining({ sonioxApiKey: 'test-key' }),
        undefined,
      );
    });

    it('reuses stored contextText on reconnect', () => {
      vi.useFakeTimers();

      connectSoniox(createMockCallbacks(), 'stored context');
      triggerOnConnected();
      mockSonioxInstance.connect.mockClear();

      triggerOnDisconnected(1006, 'connection lost');

      vi.advanceTimersByTime(1000);

      expect(mockSonioxInstance.connect).toHaveBeenCalledWith(
        expect.objectContaining({ sonioxApiKey: 'test-key' }),
        'stored context',
      );

      vi.useRealTimers();
    });

    it('clears stored contextText on resetLifecycle', () => {
      vi.useFakeTimers();

      connectSoniox(createMockCallbacks(), 'some context');
      triggerOnConnected();
      triggerOnDisconnected(1006, 'connection lost');

      resetLifecycle();

      // Now start a new session without context
      connectSoniox(createMockCallbacks());
      triggerOnConnected();
      mockSonioxInstance.connect.mockClear();

      triggerOnDisconnected(1006, 'connection lost');

      vi.advanceTimersByTime(1000);

      // Should reconnect without context since we reset and reconnected without it
      expect(mockSonioxInstance.connect).toHaveBeenCalledWith(
        expect.objectContaining({ sonioxApiKey: 'test-key' }),
        undefined,
      );

      vi.useRealTimers();
    });
  });
});
