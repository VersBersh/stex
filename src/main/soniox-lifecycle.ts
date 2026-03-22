import { SonioxClient } from './soniox';
import { startCapture, stopCapture } from './audio';
import { getSettings } from './settings';
import { classifyAudioError, classifyDisconnect } from './error-classification';
import { getReconnectDelay } from './reconnect-policy';
import type { SonioxToken, ErrorInfo, SessionState } from '../shared/types';
import { debug, info, warn, error } from './logger';

export interface SonioxLifecycleCallbacks {
  onFinalTokens: (tokens: SonioxToken[]) => void;
  onNonFinalTokens: (tokens: SonioxToken[]) => void;
  onStatusChange: (status: SessionState['status']) => void;
  onError: (error: ErrorInfo | null) => void;
  onFinalizationComplete: () => void;
}

let soniox: SonioxClient | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let activeCallbacks: SonioxLifecycleCallbacks | null = null;

export function isConnected(): boolean {
  return soniox?.connected ?? false;
}

export function finalizeSoniox(): void {
  debug('Finalization sent');
  soniox?.finalize();
}

export function sendAudio(chunk: Buffer): void {
  soniox?.sendAudio(chunk);
}

export function cancelReconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempt = 0;
}

export function resetLifecycle(): void {
  debug('Lifecycle reset');
  cancelReconnect();
  soniox?.disconnect();
  soniox = null;
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;

  const delay = getReconnectDelay(reconnectAttempt);
  info('Scheduling reconnect attempt %d in %dms', reconnectAttempt, delay);
  reconnectAttempt++;

  activeCallbacks?.onStatusChange('reconnecting');

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    attemptReconnect();
  }, delay);
}

function handleDisconnect(code: number, reason: string): void {
  warn('Soniox disconnected (code=%d, reason=%s)', code, reason);
  stopCapture();

  const { reconnectable, error } = classifyDisconnect(code, reason);

  if (reconnectable) {
    activeCallbacks?.onError(error);
    scheduleReconnect();
  } else {
    cancelReconnect();
    soniox?.disconnect();
    soniox = null;
    activeCallbacks?.onStatusChange('error');
    activeCallbacks?.onError(error);
  }
}

function onAudioData(chunk: Buffer): void {
  soniox?.sendAudio(chunk);
}

function onAudioError(err: Error): void {
  error('Audio capture error: %s', err.message);
  stopCapture();
  const errorInfo = classifyAudioError(err);
  activeCallbacks?.onStatusChange('error');
  activeCallbacks?.onError(errorInfo);
}

export function resumeCapture(): void {
  try {
    startCapture(onAudioData, onAudioError);
  } catch (err) {
    error('Failed to restart audio capture: %s', (err as Error).message);
    const errorInfo = classifyAudioError(err as Error);
    activeCallbacks?.onStatusChange('error');
    activeCallbacks?.onError(errorInfo);
    throw err;
  }
}

export function connectSoniox(callbacks: SonioxLifecycleCallbacks): void {
  activeCallbacks = callbacks;
  const settings = getSettings();
  info('Connecting to Soniox');

  soniox = new SonioxClient({
    onConnected: () => {
      info('Soniox connected, starting audio capture');
      try {
        startCapture(onAudioData, onAudioError);
      } catch (err) {
        error('Failed to start audio capture: %s', (err as Error).message);
        const errorInfo = classifyAudioError(err as Error);
        soniox?.disconnect();
        soniox = null;
        callbacks.onStatusChange('error');
        callbacks.onError(errorInfo);
        return;
      }
      callbacks.onStatusChange('recording');
    },
    onFinalTokens: (tokens: SonioxToken[]) => {
      callbacks.onFinalTokens(tokens);
    },
    onNonFinalTokens: (tokens: SonioxToken[]) => {
      callbacks.onNonFinalTokens(tokens);
    },
    onFinished: () => {
      callbacks.onFinalizationComplete();
    },
    onDisconnected: (code: number, reason: string) => {
      handleDisconnect(code, reason);
    },
    onError: (err: Error) => {
      error('Soniox error: %s', err.message);
      stopCapture();
      callbacks.onStatusChange('error');
      callbacks.onError({ type: 'unknown', message: err.message });
    },
  });

  soniox.connect(settings);
}

function attemptReconnect(): void {
  info('Attempting reconnect');
  if (soniox) {
    soniox.disconnect();
    soniox = null;
  }

  const callbacks = activeCallbacks;
  if (!callbacks) return;

  const settings = getSettings();

  soniox = new SonioxClient({
    onConnected: () => {
      reconnectAttempt = 0;
      callbacks.onStatusChange('paused');
      callbacks.onError(null);
    },
    onFinalTokens: (tokens: SonioxToken[]) => {
      callbacks.onFinalTokens(tokens);
    },
    onNonFinalTokens: (tokens: SonioxToken[]) => {
      callbacks.onNonFinalTokens(tokens);
    },
    onFinished: () => {
      callbacks.onFinalizationComplete();
    },
    onDisconnected: (code: number, reason: string) => {
      handleDisconnect(code, reason);
    },
    onError: (err: Error) => {
      error('Soniox error during reconnect: %s', err.message);
      scheduleReconnect();
    },
  });

  soniox.connect(settings);
}
