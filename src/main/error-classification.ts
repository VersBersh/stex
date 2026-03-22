import type { ErrorInfo } from '../shared/types';

export function classifyAudioError(err: Error): ErrorInfo {
  const msg = err.message.toLowerCase();
  if (msg.includes('access denied') || msg.includes('permission') || msg.includes('microphone access denied')) {
    return {
      type: 'mic-denied',
      message: 'Microphone access denied',
      action: { label: 'Grant access in Windows Settings', action: 'open-mic-settings' },
    };
  }
  if (msg.includes('device not found') || msg.includes('unavailable')) {
    return {
      type: 'mic-unavailable',
      message: 'Audio device unavailable',
    };
  }
  return { type: 'unknown', message: err.message };
}

export function classifyDisconnect(code: number, reason: string): { reconnectable: boolean; error: ErrorInfo } {
  const reasonLower = reason.toLowerCase();

  if (reasonLower.includes('api key') || reasonLower.includes('unauthorized') || reasonLower.includes('authentication')) {
    return {
      reconnectable: false,
      error: {
        type: 'api-key',
        message: 'Invalid API key',
        action: { label: 'Open Settings', action: 'open-settings' },
      },
    };
  }

  if (reasonLower.includes('rate limit') || reasonLower.includes('quota') || reasonLower.includes('too many')) {
    return {
      reconnectable: false,
      error: {
        type: 'rate-limit',
        message: 'Rate limit exceeded',
      },
    };
  }

  // Default: network issue, reconnectable
  return {
    reconnectable: true,
    error: {
      type: 'network',
      message: 'Connection lost',
    },
  };
}
