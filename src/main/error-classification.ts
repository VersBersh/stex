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

function classifyByReason(
  reason: string,
  fallback: { reconnectable: boolean; error: ErrorInfo },
): { reconnectable: boolean; error: ErrorInfo } {
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
      error: { type: 'rate-limit', message: 'Rate limit exceeded' },
    };
  }

  return fallback;
}

export function classifyDisconnect(code: number, reason: string): { reconnectable: boolean; error: ErrorInfo } {
  // Tier 1: Standard WebSocket close codes (RFC 6455) with unambiguous semantics
  switch (code) {
    case 1000: // Normal closure — server-initiated (user-initiated bypasses this path)
    case 1001: // Going away
    case 1006: // Abnormal closure (network failure)
    case 1011: // Internal server error
      return { reconnectable: true, error: { type: 'network', message: 'Connection lost' } };
    case 1008: // Policy violation — non-reconnectable; use reason to refine error type
      return classifyByReason(reason, {
        reconnectable: false,
        error: { type: 'unknown', message: reason || 'Policy violation' },
      });
  }

  // Tier 2: Application-defined codes (4000-4999) and other codes — use reason text
  return classifyByReason(reason, {
    reconnectable: true,
    error: { type: 'network', message: 'Connection lost' },
  });
}
