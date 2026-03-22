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
  it('returns non-reconnectable api-key error for authentication failures', () => {
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
      error: {
        type: 'rate-limit',
        message: 'Rate limit exceeded',
      },
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

  it('returns reconnectable network error for generic disconnect', () => {
    const result = classifyDisconnect(1006, 'connection lost');
    expect(result).toEqual({
      reconnectable: true,
      error: {
        type: 'network',
        message: 'Connection lost',
      },
    });
  });

  it('returns reconnectable for empty reason', () => {
    const result = classifyDisconnect(1006, '');
    expect(result.reconnectable).toBe(true);
    expect(result.error.type).toBe('network');
  });
});
