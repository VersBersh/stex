import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Hoisted mocks ---

const { mockSonioxInstance, MockSonioxClient, mockAudio, mockSettingsData, mockRingBufferInstance, MockAudioRingBuffer } = vi.hoisted(() => {
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

  const mockRingBufferInstance = {
    push: vi.fn(),
    sliceFrom: vi.fn(),
    clear: vi.fn(),
    currentMs: 0,
    oldestMs: null as number | null,
  };

  const MockAudioRingBuffer = vi.fn(function () { return mockRingBufferInstance; });

  return { mockSonioxInstance, MockSonioxClient, mockAudio, mockSettingsData, mockRingBufferInstance, MockAudioRingBuffer };
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

vi.mock('./audio-ring-buffer', () => ({
  AudioRingBuffer: MockAudioRingBuffer,
}));

vi.mock('./logger');

import { connectSoniox, isConnected, finalizeSoniox, sendAudio, resumeCapture, reconnectWithContext, cancelReconnect, resetLifecycle, applyTimestampOffset, capturePendingStartMs, getPendingStartMs } from './soniox-lifecycle';

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

    it('treats close code 1000 during finalization as successful completion', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();
      callbacks.onStatusChange.mockClear();

      finalizeSoniox();
      triggerOnDisconnected(1000, '');

      expect(callbacks.onFinalizationComplete).toHaveBeenCalled();
      expect(callbacks.onStatusChange).not.toHaveBeenCalledWith('error');
    });

    it('does not treat close code 1000 as finalization when not finalizing', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();
      callbacks.onStatusChange.mockClear();

      triggerOnDisconnected(1000, '');

      expect(callbacks.onFinalizationComplete).not.toHaveBeenCalled();
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

  describe('audio ring buffer', () => {
    it('creates ring buffer on connectSoniox', () => {
      MockAudioRingBuffer.mockClear();
      connectSoniox(createMockCallbacks());

      expect(MockAudioRingBuffer).toHaveBeenCalledTimes(1);
    });

    it('pushes audio chunk to ring buffer on each audio callback', () => {
      connectSoniox(createMockCallbacks());
      triggerOnConnected();

      const onAudioData = mockAudio.startCapture.mock.calls[0][0] as (chunk: Buffer) => void;
      const chunk = Buffer.alloc(3200, 0);

      onAudioData(chunk);

      expect(mockRingBufferInstance.push).toHaveBeenCalledWith(chunk);
    });

    it('pushes every audio chunk to ring buffer', () => {
      connectSoniox(createMockCallbacks());
      triggerOnConnected();

      const onAudioData = mockAudio.startCapture.mock.calls[0][0] as (chunk: Buffer) => void;
      const chunk1 = Buffer.alloc(3200, 1);
      const chunk2 = Buffer.alloc(3200, 2);
      const chunk3 = Buffer.alloc(3200, 3);

      onAudioData(chunk1);
      onAudioData(chunk2);
      onAudioData(chunk3);

      expect(mockRingBufferInstance.push).toHaveBeenCalledTimes(3);
      expect(mockRingBufferInstance.push).toHaveBeenNthCalledWith(1, chunk1);
      expect(mockRingBufferInstance.push).toHaveBeenNthCalledWith(2, chunk2);
      expect(mockRingBufferInstance.push).toHaveBeenNthCalledWith(3, chunk3);
    });

    it('clears and nulls ring buffer on resetLifecycle', () => {
      connectSoniox(createMockCallbacks());
      triggerOnConnected();

      mockRingBufferInstance.clear.mockClear();
      resetLifecycle();

      expect(mockRingBufferInstance.clear).toHaveBeenCalledTimes(1);

      // After reset, a new connectSoniox should create a new instance
      MockAudioRingBuffer.mockClear();
      connectSoniox(createMockCallbacks());
      expect(MockAudioRingBuffer).toHaveBeenCalledTimes(1);
    });

    it('ring buffer persists across disconnect/reconnect', () => {
      vi.useFakeTimers();

      connectSoniox(createMockCallbacks());
      triggerOnConnected();

      // Send some audio
      const onAudioData = mockAudio.startCapture.mock.calls[0][0] as (chunk: Buffer) => void;
      onAudioData(Buffer.alloc(3200, 0));

      mockRingBufferInstance.clear.mockClear();
      MockAudioRingBuffer.mockClear();

      // Disconnect and reconnect
      triggerOnDisconnected(1006, 'connection lost');
      vi.advanceTimersByTime(1000);

      // Ring buffer should NOT have been cleared or re-created
      expect(mockRingBufferInstance.clear).not.toHaveBeenCalled();
      expect(MockAudioRingBuffer).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('applyTimestampOffset', () => {
    it('returns same array reference when offsetMs is 0', () => {
      const tokens = [
        { text: 'hello', start_ms: 100, end_ms: 200, confidence: 0.9, is_final: true },
      ];
      const result = applyTimestampOffset(tokens, 0);
      expect(result).toBe(tokens);
    });

    it('offsets start_ms and end_ms by offsetMs', () => {
      const tokens = [
        { text: 'hello', start_ms: 100, end_ms: 200, confidence: 0.9, is_final: true },
        { text: 'world', start_ms: 300, end_ms: 400, confidence: 0.8, is_final: true },
      ];
      const result = applyTimestampOffset(tokens, 5000);
      expect(result).toEqual([
        { text: 'hello', start_ms: 5100, end_ms: 5200, confidence: 0.9, is_final: true },
        { text: 'world', start_ms: 5300, end_ms: 5400, confidence: 0.8, is_final: true },
      ]);
    });

    it('preserves all non-timestamp fields', () => {
      const tokens = [
        { text: 'hello', start_ms: 100, end_ms: 200, confidence: 0.95, is_final: false, speaker: 'A' },
      ];
      const result = applyTimestampOffset(tokens, 1000);
      expect(result[0].text).toBe('hello');
      expect(result[0].confidence).toBe(0.95);
      expect(result[0].is_final).toBe(false);
      expect(result[0].speaker).toBe('A');
    });

    it('returns new array and new objects when offset is non-zero', () => {
      const tokens = [
        { text: 'hello', start_ms: 100, end_ms: 200, confidence: 0.9, is_final: true },
      ];
      const result = applyTimestampOffset(tokens, 500);
      expect(result).not.toBe(tokens);
      expect(result[0]).not.toBe(tokens[0]);
    });

    it('handles empty array', () => {
      const result = applyTimestampOffset([], 5000);
      expect(result).toEqual([]);
    });
  });

  describe('pendingStartMs', () => {
    beforeEach(() => {
      connectSoniox(createMockCallbacks());
      triggerOnConnected();
    });

    it('captures first non-final token start_ms', () => {
      const tokens = [{ text: 'hel', start_ms: 500, end_ms: 600, confidence: 0.9, is_final: false }];
      mockSonioxInstance._events.onNonFinalTokens?.(tokens);

      capturePendingStartMs();

      expect(getPendingStartMs()).toBe(500);
    });

    it('returns null when onNonFinalTokens receives empty array', () => {
      mockSonioxInstance._events.onNonFinalTokens?.([]);

      capturePendingStartMs();

      expect(getPendingStartMs()).toBeNull();
    });

    it('returns null when no tokens ever received', () => {
      capturePendingStartMs();

      expect(getPendingStartMs()).toBeNull();
    });

    it('final tokens clear lastNonFinalStartMs but NOT pendingStartMs', () => {
      const tokens = [{ text: 'hel', start_ms: 500, end_ms: 600, confidence: 0.9, is_final: false }];
      mockSonioxInstance._events.onNonFinalTokens?.(tokens);

      capturePendingStartMs();
      expect(getPendingStartMs()).toBe(500);

      // Final tokens arrive, clearing non-final state
      mockSonioxInstance.hasPendingNonFinalTokens = false;
      mockSonioxInstance._events.onFinalTokens?.([{ text: 'hello', start_ms: 500, end_ms: 700, confidence: 0.95, is_final: true }]);

      // pendingStartMs is a frozen snapshot — NOT cleared
      expect(getPendingStartMs()).toBe(500);
    });

    it('pendingStartMs persists across finalization cycle', () => {
      const tokens = [{ text: 'hel', start_ms: 500, end_ms: 600, confidence: 0.9, is_final: false }];
      mockSonioxInstance._events.onNonFinalTokens?.(tokens);

      capturePendingStartMs();
      expect(getPendingStartMs()).toBe(500);

      // Simulate finalization: finals arrive, non-finals drain
      mockSonioxInstance.hasPendingNonFinalTokens = false;
      mockSonioxInstance._events.onFinalTokens?.([{ text: 'hello', start_ms: 500, end_ms: 700, confidence: 0.95, is_final: true }]);
      mockSonioxInstance._events.onNonFinalTokens?.([]);

      expect(getPendingStartMs()).toBe(500);
    });

    it('captures most recent non-final start', () => {
      mockSonioxInstance._events.onNonFinalTokens?.([{ text: 'h', start_ms: 100, end_ms: 200, confidence: 0.5, is_final: false }]);
      mockSonioxInstance._events.onNonFinalTokens?.([{ text: 'he', start_ms: 200, end_ms: 300, confidence: 0.6, is_final: false }]);

      capturePendingStartMs();

      expect(getPendingStartMs()).toBe(200);
    });

    it('resetLifecycle clears pendingStartMs', () => {
      mockSonioxInstance._events.onNonFinalTokens?.([{ text: 'hel', start_ms: 500, end_ms: 600, confidence: 0.9, is_final: false }]);
      capturePendingStartMs();
      expect(getPendingStartMs()).toBe(500);

      resetLifecycle();

      expect(getPendingStartMs()).toBeNull();
    });

    it('uses first token start_ms from multi-token batch', () => {
      const tokens = [
        { text: 'hel', start_ms: 300, end_ms: 400, confidence: 0.8, is_final: false },
        { text: 'lo', start_ms: 400, end_ms: 500, confidence: 0.7, is_final: false },
      ];
      mockSonioxInstance._events.onNonFinalTokens?.(tokens);

      capturePendingStartMs();

      expect(getPendingStartMs()).toBe(300);
    });
  });

  describe('connectionBaseMs', () => {
    it('initial connection passes tokens through with offset 0 (unchanged)', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();

      const tokens = [
        { text: 'hello', start_ms: 100, end_ms: 200, confidence: 0.9, is_final: true },
      ];
      mockSonioxInstance._events.onFinalTokens?.(tokens);

      // With connectionBaseMs = 0, tokens pass through unchanged (same reference)
      expect(callbacks.onFinalTokens).toHaveBeenCalledWith(tokens);
      expect(callbacks.onFinalTokens.mock.calls[0][0]).toBe(tokens);
    });

    it('initial connection passes non-final tokens through unchanged', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();

      const tokens = [
        { text: 'hel', start_ms: 50, end_ms: 100, confidence: 0.5, is_final: false },
      ];
      mockSonioxInstance._events.onNonFinalTokens?.(tokens);

      expect(callbacks.onNonFinalTokens).toHaveBeenCalledWith(tokens);
      expect(callbacks.onNonFinalTokens.mock.calls[0][0]).toBe(tokens);
    });

    it('reconnect passes tokens through with offset 0 (unchanged)', () => {
      vi.useFakeTimers();

      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();
      triggerOnDisconnected(1006, 'connection lost');

      vi.advanceTimersByTime(1000);
      // Reconnected — trigger onConnected on the new client
      mockSonioxInstance.connected = true;
      mockSonioxInstance._events.onConnected?.();

      const tokens = [
        { text: 'hello', start_ms: 100, end_ms: 200, confidence: 0.9, is_final: true },
      ];
      mockSonioxInstance._events.onFinalTokens?.(tokens);

      expect(callbacks.onFinalTokens).toHaveBeenCalledWith(tokens);
      expect(callbacks.onFinalTokens.mock.calls[0][0]).toBe(tokens);

      vi.useRealTimers();
    });
  });

  describe('reconnectWithContext', () => {
    // The MockSonioxClient constructor clears disconnect/connect mocks,
    // so we track disconnect calls via a side-effect array.
    let disconnectCalls: number;

    beforeEach(() => {
      disconnectCalls = 0;
      mockSonioxInstance.disconnect.mockImplementation(() => { disconnectCalls++; });
      // Ensure startCapture doesn't carry a throwing impl from earlier tests
      mockAudio.startCapture.mockImplementation(vi.fn());
    });

    it('disconnects old client and connects new one with context', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks, 'old context');
      triggerOnConnected();
      disconnectCalls = 0;

      reconnectWithContext('corrected text');

      expect(disconnectCalls).toBe(1);
      expect(mockSonioxInstance.connect).toHaveBeenCalledWith(
        expect.objectContaining({ sonioxApiKey: 'test-key' }),
        'corrected text',
      );
    });

    it('starts audio capture on new connection connected event', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();
      mockAudio.startCapture.mockClear();

      reconnectWithContext('text');
      triggerOnConnected();

      expect(mockAudio.startCapture).toHaveBeenCalled();
    });

    it('sets status to recording after reconnect', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();
      callbacks.onStatusChange.mockClear();

      reconnectWithContext('text');
      triggerOnConnected();

      expect(callbacks.onStatusChange).toHaveBeenCalledWith('recording');
    });

    it('preserves ring buffer across reconnect', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();

      // Send some audio to populate ring buffer
      const onAudioData = mockAudio.startCapture.mock.calls[0][0] as (chunk: Buffer) => void;
      onAudioData(Buffer.alloc(3200, 0));

      mockRingBufferInstance.clear.mockClear();
      MockAudioRingBuffer.mockClear();

      reconnectWithContext('text');

      // Ring buffer should NOT have been cleared or re-created
      expect(mockRingBufferInstance.clear).not.toHaveBeenCalled();
      expect(MockAudioRingBuffer).not.toHaveBeenCalled();
    });

    it('updates stored context text for future network reconnects', () => {
      vi.useFakeTimers();

      const callbacks = createMockCallbacks();
      connectSoniox(callbacks, 'old context');
      triggerOnConnected();

      reconnectWithContext('fresh');
      triggerOnConnected();
      mockSonioxInstance.connect.mockClear();

      // Trigger a network disconnect on the new connection
      triggerOnDisconnected(1006, 'connection lost');

      // Advance past reconnect delay
      vi.advanceTimersByTime(1000);

      expect(mockSonioxInstance.connect).toHaveBeenCalledWith(
        expect.objectContaining({ sonioxApiKey: 'test-key' }),
        'fresh',
      );

      vi.useRealTimers();
    });

    it('handles audio capture error on reconnected connection', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();
      callbacks.onStatusChange.mockClear();

      reconnectWithContext('text');
      mockAudio.startCapture.mockImplementation(() => { throw new Error('No mic'); });
      triggerOnConnected();

      expect(callbacks.onStatusChange).toHaveBeenCalledWith('error');
    });

    it('offsets tokens by connectionBaseMs from ring buffer', () => {
      const callbacks = createMockCallbacks();
      connectSoniox(callbacks);
      triggerOnConnected();

      // Simulate ring buffer having accumulated 5000ms of audio
      mockRingBufferInstance.currentMs = 5000;

      reconnectWithContext('text');
      mockAudio.startCapture.mockClear();
      triggerOnConnected();

      const tokens = [
        { text: 'hello', start_ms: 100, end_ms: 200, confidence: 0.9, is_final: true },
      ];
      mockSonioxInstance._events.onFinalTokens?.(tokens);

      expect(callbacks.onFinalTokens).toHaveBeenCalledWith([
        { text: 'hello', start_ms: 5100, end_ms: 5200, confidence: 0.9, is_final: true },
      ]);
    });
  });
});
