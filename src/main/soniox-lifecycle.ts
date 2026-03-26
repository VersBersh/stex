import { SonioxClient } from './soniox';
import { startCapture, stopCapture } from './audio';
import { getSettings } from './settings';
import { classifyAudioError, classifyDisconnect } from './error-classification';
import { getReconnectDelay } from './reconnect-policy';
import { MIN_DB, computeDbFromPcm16, createAudioLevelMonitor, createSoundEventDetector, type AudioLevelMonitor, type SoundEventDetector } from './audio-level-monitor';
import { AudioRingBuffer } from './audio-ring-buffer';
import type { SonioxToken, ErrorInfo, SessionState } from '../shared/types';
import { debug, info, warn, error } from './logger';

export interface SonioxLifecycleCallbacks {
  onFinalTokens: (tokens: SonioxToken[]) => void;
  onNonFinalTokens: (tokens: SonioxToken[]) => void;
  onStatusChange: (status: SessionState['status']) => void;
  onError: (error: ErrorInfo | null) => void;
  onFinalizationComplete: () => void;
  onAudioLevel?: (dB: number) => void;
}

let soniox: SonioxClient | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let activeCallbacks: SonioxLifecycleCallbacks | null = null;
let storedContextText: string | null = null;
let levelMonitor: AudioLevelMonitor | null = null;
let audioChunkCount = 0;
let soundEventDetector: SoundEventDetector | null = null;
let awaitingFinalization = false;
let ringBuffer: AudioRingBuffer | null = null;
let connectionBaseMs = 0;

export function isConnected(): boolean {
  return soniox?.connected ?? false;
}

export function hasPendingNonFinalTokens(): boolean {
  return soniox?.hasPendingNonFinalTokens ?? false;
}

export function finalizeSoniox(): void {
  debug('Finalization sent');
  awaitingFinalization = true;
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

function flushSoundEvent(): void {
  if (soundEventDetector) {
    const event = soundEventDetector.flush();
    if (event) {
      debug('sound-event: peak_dB=%s duration_ms=%d timestamp=%s', event.peakDb.toFixed(1), event.durationMs, event.timestamp);
    }
  }
}

export function applyTimestampOffset(tokens: SonioxToken[], offsetMs: number): SonioxToken[] {
  if (offsetMs === 0) return tokens;
  return tokens.map(t => ({
    ...t,
    start_ms: t.start_ms + offsetMs,
    end_ms: t.end_ms + offsetMs,
  }));
}

export function resetLifecycle(): void {
  debug('Lifecycle reset');
  cancelReconnect();
  awaitingFinalization = false;
  soniox?.disconnect();
  soniox = null;
  storedContextText = null;
  connectionBaseMs = 0;
  ringBuffer?.clear();
  ringBuffer = null;
  levelMonitor = null;
  audioChunkCount = 0;
  flushSoundEvent();
  soundEventDetector = null;
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
  activeCallbacks?.onAudioLevel?.(MIN_DB);
  flushSoundEvent();

  // Close code 1000 during finalization is expected — Soniox signals
  // completion by closing the WebSocket rather than sending finished:true.
  if (awaitingFinalization && code === 1000) {
    info('Soniox closed during finalization (expected)');
    awaitingFinalization = false;
    activeCallbacks?.onFinalizationComplete();
    return;
  }

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
  ringBuffer?.push(chunk);
  soniox?.sendAudio(chunk);
  const dB = computeDbFromPcm16(chunk);
  audioChunkCount++;
  if (audioChunkCount === 1) {
    const sampleCount = Math.floor(chunk.length / 2);
    const first4 = [];
    for (let i = 0; i < Math.min(4, sampleCount); i++) {
      first4.push(chunk.readInt16LE(i * 2));
    }
    info('Audio first chunk: size=%d samples=%d dB=%d firstSamples=%j', chunk.length, sampleCount, dB, first4);
  }
  if (audioChunkCount <= 10 || audioChunkCount % 25 === 0) {
    debug('Audio chunk #%d: size=%d dB=%d', audioChunkCount, chunk.length, dB);
  }
  if (levelMonitor && activeCallbacks?.onAudioLevel) {
    const smoothed = levelMonitor.push(dB);
    activeCallbacks.onAudioLevel(smoothed);
  }
  if (soundEventDetector) {
    const chunkDurationMs = chunk.length / 2 / 16000 * 1000;
    const event = soundEventDetector.push(dB, chunkDurationMs);
    if (event) {
      debug('sound-event: peak_dB=%s duration_ms=%d timestamp=%s', event.peakDb.toFixed(1), event.durationMs, event.timestamp);
    }
  }
}

function onAudioError(err: Error): void {
  error('Audio capture error: %s', err.message);
  stopCapture();
  activeCallbacks?.onAudioLevel?.(MIN_DB);
  flushSoundEvent();
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

export function connectSoniox(callbacks: SonioxLifecycleCallbacks, contextText?: string): void {
  audioChunkCount = 0;
  ringBuffer = new AudioRingBuffer();
  activeCallbacks = callbacks;
  storedContextText = contextText ?? null;
  levelMonitor = createAudioLevelMonitor();
  const settings = getSettings();
  soundEventDetector = createSoundEventDetector(settings.silenceThresholdDb);
  const keyLen = settings.sonioxApiKey.length;
  const keyPreview = keyLen > 4 ? settings.sonioxApiKey.slice(0, 4) + '...' : '(empty)';
  info('Connecting to Soniox (key=%s, len=%d)', keyPreview, keyLen);

  const baseMs = connectionBaseMs;
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
      callbacks.onFinalTokens(applyTimestampOffset(tokens, baseMs));
    },
    onNonFinalTokens: (tokens: SonioxToken[]) => {
      callbacks.onNonFinalTokens(applyTimestampOffset(tokens, baseMs));
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
      callbacks.onAudioLevel?.(MIN_DB);
      callbacks.onStatusChange('error');
      callbacks.onError({ type: 'unknown', message: err.message });
    },
  });

  soniox.connect(settings, contextText);
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
  const baseMs = connectionBaseMs;

  soniox = new SonioxClient({
    onConnected: () => {
      reconnectAttempt = 0;
      callbacks.onStatusChange('paused');
      callbacks.onError(null);
    },
    onFinalTokens: (tokens: SonioxToken[]) => {
      callbacks.onFinalTokens(applyTimestampOffset(tokens, baseMs));
    },
    onNonFinalTokens: (tokens: SonioxToken[]) => {
      callbacks.onNonFinalTokens(applyTimestampOffset(tokens, baseMs));
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

  soniox.connect(settings, storedContextText ?? undefined);
}
