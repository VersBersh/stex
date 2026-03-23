import { describe, it, expect } from 'vitest';
import { classifyAudioError, classifyDisconnect } from './error-classification';

describe('classifyAudioError', () => {
  it('returns mic-denied for access denied errors', () => {
    const result = classifyAudioError(new Error('Microphone access denied'));
    expect(result).toEqual({
      type: 'mic-denied',
      message: 'Microphone access denied',
      action: { label: 'Grant access in Windows Settings', action: 'open-mic-settings' },
    });
  });

  it('returns mic-denied for permission errors', () => {
    const result = classifyAudioError(new Error('No permission to access audio'));
    expect(result.type).toBe('mic-denied');
  });

  it('returns mic-unavailable for device not found errors', () => {
    const result = classifyAudioError(new Error('Audio device not found: MyMic'));
    expect(result).toEqual({
      type: 'mic-unavailable',
      message: 'Audio device unavailable',
    });
  });

  it('returns mic-unavailable for unavailable errors', () => {
    const result = classifyAudioError(new Error('Device unavailable'));
    expect(result.type).toBe('mic-unavailable');
  });

  it('returns unknown for unrecognized errors', () => {
    const result = classifyAudioError(new Error('Something unexpected'));
    expect(result).toEqual({
      type: 'unknown',
      message: 'Something unexpected',
    });
  });
});

describe('classifyDisconnect', () => {
  describe('standard close codes (code-based classification)', () => {
    it('returns non-reconnectable for 1000 (normal closure)', () => {
      const result = classifyDisconnect(1000, '');
      expect(result).toEqual({
        reconnectable: false,
        error: { type: 'unknown', message: 'Connection closed by server' },
      });
    });

    it('classifies 1000 with auth reason as api-key error', () => {
      const result = classifyDisconnect(1000, 'invalid api key');
      expect(result.reconnectable).toBe(false);
      expect(result.error.type).toBe('api-key');
    });

    it('returns reconnectable for 1001 (going away)', () => {
      const result = classifyDisconnect(1001, 'server shutting down');
      expect(result.reconnectable).toBe(true);
      expect(result.error.type).toBe('network');
    });

    it('returns reconnectable for 1006 (abnormal closure)', () => {
      const result = classifyDisconnect(1006, 'connection lost');
      expect(result).toEqual({
        reconnectable: true,
        error: { type: 'network', message: 'Connection lost' },
      });
    });

    it('returns reconnectable for 1011 (internal server error)', () => {
      const result = classifyDisconnect(1011, 'internal error');
      expect(result.reconnectable).toBe(true);
      expect(result.error.type).toBe('network');
    });

    it('ignores reason text when standard code matches', () => {
      // Even though reason says "api key", code 1006 takes precedence
      const result = classifyDisconnect(1006, 'invalid api key');
      expect(result.reconnectable).toBe(true);
      expect(result.error.type).toBe('network');
    });
  });

  describe('reason-text fallback (application-defined and ambiguous codes)', () => {
    it('returns non-reconnectable api-key error for auth reason', () => {
      const result = classifyDisconnect(4001, 'invalid api key');
      expect(result).toEqual({
        reconnectable: false,
        error: {
          type: 'api-key',
          message: 'Invalid API key',
          action: { label: 'Open Settings', action: 'open-settings' },
        },
      });
    });

    it('detects unauthorized reason', () => {
      const result = classifyDisconnect(4001, 'unauthorized');
      expect(result.reconnectable).toBe(false);
      expect(result.error.type).toBe('api-key');
    });

    it('detects authentication reason', () => {
      const result = classifyDisconnect(4001, 'authentication failed');
      expect(result.reconnectable).toBe(false);
      expect(result.error.type).toBe('api-key');
    });

    it('returns non-reconnectable rate-limit error', () => {
      const result = classifyDisconnect(4029, 'rate limit exceeded');
      expect(result).toEqual({
        reconnectable: false,
        error: { type: 'rate-limit', message: 'Rate limit exceeded' },
      });
    });

    it('detects quota reason as rate-limit', () => {
      const result = classifyDisconnect(4029, 'quota exceeded');
      expect(result.reconnectable).toBe(false);
      expect(result.error.type).toBe('rate-limit');
    });

    it('detects too many reason as rate-limit', () => {
      const result = classifyDisconnect(4029, 'too many requests');
      expect(result.reconnectable).toBe(false);
      expect(result.error.type).toBe('rate-limit');
    });

    it('classifies 1008 with auth reason as api-key error', () => {
      const result = classifyDisconnect(1008, 'unauthorized');
      expect(result.reconnectable).toBe(false);
      expect(result.error.type).toBe('api-key');
    });

    it('classifies 1008 with generic reason as non-reconnectable', () => {
      const result = classifyDisconnect(1008, 'policy violation');
      expect(result.reconnectable).toBe(false);
      expect(result.error.type).toBe('unknown');
      expect(result.error.message).toBe('policy violation');
    });

    it('returns reconnectable network error for generic disconnect', () => {
      const result = classifyDisconnect(4000, 'something unexpected');
      expect(result).toEqual({
        reconnectable: true,
        error: { type: 'network', message: 'Connection lost' },
      });
    });

    it('returns reconnectable for empty reason', () => {
      const result = classifyDisconnect(4000, '');
      expect(result.reconnectable).toBe(true);
      expect(result.error.type).toBe('network');
    });
  });
});
