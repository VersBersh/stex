import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mock WebSocket ---

const { MockWebSocket, lastCreatedSocket } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter } = require('events') as typeof import('events');

  let lastSocket: InstanceType<typeof MockWS> | null = null;

  class MockWS extends EventEmitter {
    static OPEN = 1;
    static CLOSED = 3;

    url: string;
    readyState: number = MockWS.OPEN;
    send = vi.fn();
    close = vi.fn(() => {
      this.readyState = MockWS.CLOSED;
    });
    override removeAllListeners(event?: string | symbol): this {
      return EventEmitter.prototype.removeAllListeners.call(this, event) as this;
    }

    constructor(url: string) {
      super();
      this.url = url;
      lastSocket = this;
      // Simulate async open
      queueMicrotask(() => this.emit('open'));
    }
  }

  return {
    MockWebSocket: MockWS,
    lastCreatedSocket: () => lastSocket,
  };
});

vi.mock('ws', () => ({
  default: MockWebSocket,
}));

import { SonioxClient } from './soniox';
import type { AppSettings } from '../shared/types';
import { APP_SETTINGS_DEFAULTS } from './settings';

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return { ...APP_SETTINGS_DEFAULTS, sonioxApiKey: 'test-key-123', ...overrides };
}

function makeResponse(
  tokens: Array<{ text: string; start_ms: number; end_ms: number; confidence: number; is_final: boolean }>,
  audio_final_proc_ms: number,
  audio_total_proc_ms: number,
  finished?: boolean,
) {
  return JSON.stringify({
    tokens,
    audio_final_proc_ms,
    audio_total_proc_ms,
    ...(finished !== undefined && { finished }),
  });
}

describe('SonioxClient', () => {
  let events: {
    onFinalTokens: ReturnType<typeof vi.fn>;
    onNonFinalTokens: ReturnType<typeof vi.fn>;
    onFinished: ReturnType<typeof vi.fn>;
    onConnected: ReturnType<typeof vi.fn>;
    onDisconnected: ReturnType<typeof vi.fn>;
    onError: ReturnType<typeof vi.fn>;
  };
  let client: SonioxClient;

  beforeEach(() => {
    events = {
      onFinalTokens: vi.fn(),
      onNonFinalTokens: vi.fn(),
      onFinished: vi.fn(),
      onConnected: vi.fn(),
      onDisconnected: vi.fn(),
      onError: vi.fn(),
    };
    client = new SonioxClient(events as never);
  });

  afterEach(() => {
    client.disconnect();
  });

  describe('connect', () => {
    it('creates a WebSocket to the Soniox endpoint', async () => {
      client.connect(makeSettings());
      await vi.waitFor(() => expect(lastCreatedSocket()).not.toBeNull());
      expect(lastCreatedSocket()!.url).toBe('wss://stt.soniox.com/transcribe');
    });

    it('sends configuration message on open', async () => {
      const settings = makeSettings({
        sonioxApiKey: 'my-api-key',
        sonioxModel: 'stt-rt-preview',
        language: 'en',
        maxEndpointDelayMs: 1500,
      });
      client.connect(settings);
      await vi.waitFor(() => expect(events.onConnected).toHaveBeenCalled());

      const socket = lastCreatedSocket()!;
      expect(socket.send).toHaveBeenCalledTimes(1);
      const configMsg = JSON.parse(socket.send.mock.calls[0][0] as string);
      expect(configMsg).toEqual({
        api_key: 'my-api-key',
        model: 'stt-rt-preview',
        audio_format: 'pcm_s16le',
        sample_rate: 16000,
        num_channels: 1,
        language_hints: ['en'],
        max_endpoint_delay_ms: 1500,
      });
    });

    it('emits onConnected after open', async () => {
      client.connect(makeSettings());
      await vi.waitFor(() => expect(events.onConnected).toHaveBeenCalledTimes(1));
    });

    it('reports connected state after open', async () => {
      expect(client.connected).toBe(false);
      client.connect(makeSettings());
      await vi.waitFor(() => expect(client.connected).toBe(true));
    });
  });

  describe('sendAudio', () => {
    it('sends buffer as binary frame', async () => {
      client.connect(makeSettings());
      await vi.waitFor(() => expect(events.onConnected).toHaveBeenCalled());

      const chunk = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      client.sendAudio(chunk);

      const socket = lastCreatedSocket()!;
      // First call is config message, second is audio
      expect(socket.send).toHaveBeenCalledTimes(2);
      expect(socket.send.mock.calls[1][0]).toBe(chunk);
    });

    it('is a no-op when not connected', () => {
      const chunk = Buffer.from([0x01, 0x02]);
      client.sendAudio(chunk);
      // No socket exists, no error thrown
    });
  });

  describe('finalize', () => {
    it('sends empty buffer to signal end of stream', async () => {
      client.connect(makeSettings());
      await vi.waitFor(() => expect(events.onConnected).toHaveBeenCalled());

      client.finalize();

      const socket = lastCreatedSocket()!;
      // Config message + empty frame
      expect(socket.send).toHaveBeenCalledTimes(2);
      const sentData = socket.send.mock.calls[1][0] as Buffer;
      expect(Buffer.isBuffer(sentData)).toBe(true);
      expect(sentData.length).toBe(0);
    });

    it('is a no-op when not connected', () => {
      client.finalize();
      // No error thrown
    });
  });

  describe('token parsing', () => {
    it('separates final and non-final tokens', async () => {
      client.connect(makeSettings());
      await vi.waitFor(() => expect(events.onConnected).toHaveBeenCalled());

      const socket = lastCreatedSocket()!;
      const msg = makeResponse(
        [
          { text: 'Hello ', start_ms: 120, end_ms: 450, confidence: 0.95, is_final: true },
          { text: 'world', start_ms: 460, end_ms: 780, confidence: 0.72, is_final: false },
        ],
        450,
        780,
      );
      socket.emit('message', msg);

      expect(events.onFinalTokens).toHaveBeenCalledTimes(1);
      expect(events.onFinalTokens.mock.calls[0][0]).toEqual([
        { text: 'Hello ', start_ms: 120, end_ms: 450, confidence: 0.95, is_final: true },
      ]);

      expect(events.onNonFinalTokens).toHaveBeenCalledTimes(1);
      expect(events.onNonFinalTokens.mock.calls[0][0]).toEqual([
        { text: 'world', start_ms: 460, end_ms: 780, confidence: 0.72, is_final: false },
      ]);
    });

    it('tracks audio_final_proc_ms to identify new final tokens', async () => {
      client.connect(makeSettings());
      await vi.waitFor(() => expect(events.onConnected).toHaveBeenCalled());

      const socket = lastCreatedSocket()!;

      // Response 1: "How are " is final
      socket.emit(
        'message',
        makeResponse(
          [
            { text: 'How are ', start_ms: 0, end_ms: 300, confidence: 0.9, is_final: true },
            { text: 'you', start_ms: 310, end_ms: 500, confidence: 0.7, is_final: false },
          ],
          300,
          500,
        ),
      );

      expect(events.onFinalTokens).toHaveBeenCalledTimes(1);

      // Response 2: "How are " is final again (already seen), "you doing" is final (new)
      socket.emit(
        'message',
        makeResponse(
          [
            { text: 'How are ', start_ms: 0, end_ms: 300, confidence: 0.9, is_final: true },
            { text: 'you doing', start_ms: 310, end_ms: 700, confidence: 0.85, is_final: true },
          ],
          700,
          700,
        ),
      );

      expect(events.onFinalTokens).toHaveBeenCalledTimes(2);
      // Second call should only contain the new final token
      expect(events.onFinalTokens.mock.calls[1][0]).toEqual([
        { text: 'you doing', start_ms: 310, end_ms: 700, confidence: 0.85, is_final: true },
      ]);
    });

    it('does not emit onFinalTokens when there are no new final tokens', async () => {
      client.connect(makeSettings());
      await vi.waitFor(() => expect(events.onConnected).toHaveBeenCalled());

      const socket = lastCreatedSocket()!;
      socket.emit(
        'message',
        makeResponse(
          [{ text: 'hello', start_ms: 0, end_ms: 200, confidence: 0.8, is_final: false }],
          0,
          200,
        ),
      );

      expect(events.onFinalTokens).not.toHaveBeenCalled();
      expect(events.onNonFinalTokens).toHaveBeenCalledTimes(1);
    });

    it('does not emit onNonFinalTokens when there are no non-final tokens', async () => {
      client.connect(makeSettings());
      await vi.waitFor(() => expect(events.onConnected).toHaveBeenCalled());

      const socket = lastCreatedSocket()!;
      socket.emit(
        'message',
        makeResponse(
          [{ text: 'done', start_ms: 0, end_ms: 200, confidence: 0.95, is_final: true }],
          200,
          200,
        ),
      );

      expect(events.onFinalTokens).toHaveBeenCalledTimes(1);
      expect(events.onNonFinalTokens).not.toHaveBeenCalled();
    });
  });

  describe('finalization response', () => {
    it('emits onFinished when finished: true is received', async () => {
      client.connect(makeSettings());
      await vi.waitFor(() => expect(events.onConnected).toHaveBeenCalled());

      const socket = lastCreatedSocket()!;
      socket.emit('message', makeResponse([], 0, 0, true));

      expect(events.onFinished).toHaveBeenCalledTimes(1);
    });

    it('processes tokens in a finished response before emitting onFinished', async () => {
      client.connect(makeSettings());
      await vi.waitFor(() => expect(events.onConnected).toHaveBeenCalled());

      const callOrder: string[] = [];
      events.onFinalTokens.mockImplementation(() => callOrder.push('finalTokens'));
      events.onFinished.mockImplementation(() => callOrder.push('finished'));

      const socket = lastCreatedSocket()!;
      socket.emit(
        'message',
        makeResponse(
          [{ text: 'last word', start_ms: 0, end_ms: 500, confidence: 0.9, is_final: true }],
          500,
          500,
          true,
        ),
      );

      expect(events.onFinalTokens).toHaveBeenCalledTimes(1);
      expect(events.onFinished).toHaveBeenCalledTimes(1);
      expect(callOrder).toEqual(['finalTokens', 'finished']);
    });
  });

  describe('disconnect', () => {
    it('closes the WebSocket and reports not connected', async () => {
      client.connect(makeSettings());
      await vi.waitFor(() => expect(client.connected).toBe(true));

      client.disconnect();

      expect(client.connected).toBe(false);
      expect(lastCreatedSocket()!.close).toHaveBeenCalled();
    });

    it('emits onDisconnected with code and reason on WebSocket close', async () => {
      client.connect(makeSettings());
      await vi.waitFor(() => expect(events.onConnected).toHaveBeenCalled());

      const socket = lastCreatedSocket()!;
      socket.emit('close', 1006, 'Connection lost');

      expect(events.onDisconnected).toHaveBeenCalledTimes(1);
      expect(events.onDisconnected).toHaveBeenCalledWith(1006, 'Connection lost');
    });

    it('emits onError on WebSocket error', async () => {
      client.connect(makeSettings());
      await vi.waitFor(() => expect(events.onConnected).toHaveBeenCalled());

      const socket = lastCreatedSocket()!;
      const err = new Error('connection failed');
      socket.emit('error', err);

      expect(events.onError).toHaveBeenCalledWith(err);
    });
  });

  describe('stale socket protection', () => {
    it('ignores events from a previous socket after reconnect', async () => {
      client.connect(makeSettings());
      await vi.waitFor(() => expect(events.onConnected).toHaveBeenCalled());
      const oldSocket = lastCreatedSocket()!;

      // Reconnect creates a new socket
      client.connect(makeSettings());
      await vi.waitFor(() => expect(events.onConnected).toHaveBeenCalledTimes(2));

      // Old socket emits a message — should be ignored
      oldSocket.emit(
        'message',
        makeResponse(
          [{ text: 'stale', start_ms: 0, end_ms: 100, confidence: 0.5, is_final: true }],
          100,
          100,
        ),
      );

      // Only the config-related calls from connect, no token events from stale socket
      expect(events.onFinalTokens).not.toHaveBeenCalled();
    });
  });

  describe('lastFinalProcMs reset', () => {
    it('resets watermark on new connection', async () => {
      client.connect(makeSettings());
      await vi.waitFor(() => expect(events.onConnected).toHaveBeenCalled());

      const socket1 = lastCreatedSocket()!;
      socket1.emit(
        'message',
        makeResponse(
          [{ text: 'hello', start_ms: 0, end_ms: 300, confidence: 0.9, is_final: true }],
          300,
          300,
        ),
      );
      expect(events.onFinalTokens).toHaveBeenCalledTimes(1);

      // Reconnect — watermark should reset
      client.connect(makeSettings());
      await vi.waitFor(() => expect(events.onConnected).toHaveBeenCalledTimes(2));

      const socket2 = lastCreatedSocket()!;
      // Same start_ms=0 token should be seen as new since watermark reset
      socket2.emit(
        'message',
        makeResponse(
          [{ text: 'hello', start_ms: 0, end_ms: 300, confidence: 0.9, is_final: true }],
          300,
          300,
        ),
      );
      expect(events.onFinalTokens).toHaveBeenCalledTimes(2);
    });
  });

  describe('message data handling', () => {
    it('handles Buffer message data', async () => {
      client.connect(makeSettings());
      await vi.waitFor(() => expect(events.onConnected).toHaveBeenCalled());

      const socket = lastCreatedSocket()!;
      const msg = Buffer.from(
        makeResponse(
          [{ text: 'buf', start_ms: 0, end_ms: 100, confidence: 0.9, is_final: true }],
          100,
          100,
        ),
      );
      socket.emit('message', msg);

      expect(events.onFinalTokens).toHaveBeenCalledTimes(1);
      expect(events.onFinalTokens.mock.calls[0][0][0].text).toBe('buf');
    });

    it('emits onError for invalid JSON', async () => {
      client.connect(makeSettings());
      await vi.waitFor(() => expect(events.onConnected).toHaveBeenCalled());

      const socket = lastCreatedSocket()!;
      socket.emit('message', 'not valid json {{{');

      expect(events.onError).toHaveBeenCalledTimes(1);
      expect(events.onError.mock.calls[0][0].message).toContain('Failed to parse Soniox response');
    });
  });
});
