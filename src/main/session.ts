import { ipcMain, clipboard, shell } from 'electron';
import { SonioxClient } from './soniox';
import { startCapture, stopCapture } from './audio';
import { getOverlayWindow, showOverlay, hideOverlay, showSettings, setOverlayCloseHandler } from './window';
import { getSettings } from './settings';
import { flashTrayIcon } from './tray';
import { IpcChannels } from '../shared/ipc';
import type { SessionState, SonioxToken, ErrorInfo } from '../shared/types';
import { classifyAudioError, classifyDisconnect } from './error-classification';
import { getReconnectDelay } from './reconnect-policy';

const FINALIZATION_TIMEOUT_MS = 5000;
const CLIPBOARD_TIMEOUT_MS = 2000;
let status: SessionState['status'] = 'idle';
let soniox: SonioxClient | null = null;
let activeTransition: Promise<void> | null = null;
let currentFinalizationResolver: (() => void) | null = null;
let initialized = false;
let pauseHandler: ((...args: unknown[]) => void) | null = null;
let resumeHandler: ((...args: unknown[]) => void) | null = null;
let dismissErrorHandler: ((...args: unknown[]) => void) | null = null;
let openSettingsHandler: ((...args: unknown[]) => void) | null = null;
let openMicSettingsHandler: ((...args: unknown[]) => void) | null = null;
let escapeHideHandler: ((...args: unknown[]) => void) | null = null;

// Reconnection state
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;

function sendToRenderer(channel: string, ...args: unknown[]): void {
  const win = getOverlayWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}

function sendStatus(): void {
  sendToRenderer(IpcChannels.SESSION_STATUS, status);
}

function sendError(error: ErrorInfo | null): void {
  sendToRenderer(IpcChannels.SESSION_ERROR, error);
}

function waitForFinalization(timeoutMs = FINALIZATION_TIMEOUT_MS): Promise<void> {
  return new Promise<void>((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        currentFinalizationResolver = null;
        console.warn('Finalization timed out after %dms, proceeding anyway', timeoutMs);
        resolve();
      }
    }, timeoutMs);

    currentFinalizationResolver = () => {
      if (!resolved) {
        resolved = true;
        currentFinalizationResolver = null;
        clearTimeout(timer);
        resolve();
      }
    };
  });
}

function waitForClipboardText(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const handler = (_event: unknown, text: string) => {
      clearTimeout(timer);
      if (text && text.length > 0) {
        clipboard.writeText(text);
        resolve(true);
      } else {
        resolve(false);
      }
    };

    const timer = setTimeout(() => {
      ipcMain.removeListener(IpcChannels.SESSION_TEXT, handler);
      resolve(false);
    }, CLIPBOARD_TIMEOUT_MS);

    ipcMain.once(IpcChannels.SESSION_TEXT, handler);
    sendToRenderer(IpcChannels.SESSION_TEXT);
  });
}

function onAudioData(chunk: Buffer): void {
  soniox?.sendAudio(chunk);
}

function onAudioError(err: Error): void {
  console.error('Audio capture error:', err.message);
  stopCapture();
  const errorInfo = classifyAudioError(err);
  status = 'error';
  sendStatus();
  sendError(errorInfo);
}

function cancelReconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempt = 0;
}

function clearError(): void {
  sendError(null);
}

function scheduleReconnect(): void {
  // Guard: don't schedule if a timer is already pending
  if (reconnectTimer) return;

  const delay = getReconnectDelay(reconnectAttempt);
  reconnectAttempt++;

  status = 'reconnecting';
  sendStatus();

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    attemptReconnect();
  }, delay);
}

function attemptReconnect(): void {
  // Tear down any existing client before creating a new one
  if (soniox) {
    soniox.disconnect();
    soniox = null;
  }

  const settings = getSettings();

  soniox = new SonioxClient({
    onConnected: () => {
      // Reconnected successfully — wait for user to resume
      reconnectAttempt = 0;
      status = 'paused';
      sendStatus();
      clearError();
    },
    onFinalTokens: (tokens: SonioxToken[]) => {
      sendToRenderer(IpcChannels.TOKENS_FINAL, tokens);
    },
    onNonFinalTokens: (tokens: SonioxToken[]) => {
      sendToRenderer(IpcChannels.TOKENS_NONFINAL, tokens);
    },
    onFinished: () => {
      currentFinalizationResolver?.();
    },
    onDisconnected: (_code: number, _reason: string) => {
      // Reconnect attempt failed — schedule another try
      // Funnel through single path to prevent overlapping timers
      scheduleReconnect();
    },
    onError: (err: Error) => {
      console.error('Soniox error during reconnect:', err.message);
      // Reconnect attempt failed — schedule another try
      scheduleReconnect();
    },
  });

  soniox.connect(settings);
}

function handleDisconnect(code: number, reason: string): void {
  stopCapture();

  const { reconnectable, error } = classifyDisconnect(code, reason);

  if (reconnectable) {
    sendError(error);
    scheduleReconnect();
  } else {
    cancelReconnect();
    soniox?.disconnect();
    soniox = null;
    status = 'error';
    sendStatus();
    sendError(error);
  }
}

function createSonioxEvents() {
  return {
    onConnected: () => {
      try {
        startCapture(onAudioData, onAudioError);
      } catch (err) {
        console.error('Failed to start audio capture:', (err as Error).message);
        const errorInfo = classifyAudioError(err as Error);
        soniox?.disconnect();
        soniox = null;
        status = 'error';
        sendStatus();
        sendError(errorInfo);
        return;
      }
      status = 'recording';
      sendStatus();
    },
    onFinalTokens: (tokens: SonioxToken[]) => {
      sendToRenderer(IpcChannels.TOKENS_FINAL, tokens);
    },
    onNonFinalTokens: (tokens: SonioxToken[]) => {
      sendToRenderer(IpcChannels.TOKENS_NONFINAL, tokens);
    },
    onFinished: () => {
      currentFinalizationResolver?.();
    },
    onDisconnected: (code: number, reason: string) => {
      handleDisconnect(code, reason);
    },
    onError: (err: Error) => {
      console.error('Soniox error:', err.message);
      stopCapture();
      status = 'error';
      sendStatus();
      sendError({ type: 'unknown', message: err.message });
    },
  };
}

function startSession(): void {
  if (status !== 'idle') return;

  status = 'connecting';
  sendStatus();

  const settings = getSettings();
  sendToRenderer(IpcChannels.SESSION_START, settings.onShow);
  soniox = new SonioxClient(createSonioxEvents());
  soniox.connect(settings);
}

async function pauseSession(): Promise<void> {
  if (status !== 'recording') return;

  // Transition immediately to prevent re-entry during finalization
  status = 'paused';

  stopCapture();
  soniox?.finalize();

  await waitForFinalization();

  sendToRenderer(IpcChannels.TOKENS_NONFINAL, []);
  sendToRenderer(IpcChannels.SESSION_PAUSED);
  sendStatus();
}

function resumeSession(): void {
  if (status !== 'paused') return;

  try {
    startCapture(onAudioData, onAudioError);
  } catch (err) {
    console.error('Failed to restart audio capture:', (err as Error).message);
    const errorInfo = classifyAudioError(err as Error);
    status = 'error';
    sendStatus();
    sendError(errorInfo);
    return;
  }

  sendToRenderer(IpcChannels.SESSION_RESUMED);
  status = 'recording';
  sendStatus();
}

async function stopSession(): Promise<void> {
  if (status === 'idle' || status === 'finalizing') return;

  cancelReconnect();

  status = 'finalizing';
  sendStatus();

  stopCapture();

  if (soniox?.connected) {
    soniox.finalize();
    await waitForFinalization();
  }

  sendToRenderer(IpcChannels.TOKENS_NONFINAL, []);
  sendToRenderer(IpcChannels.SESSION_STOP);

  const settings = getSettings();
  if (settings.onHide === 'clipboard') {
    const copied = await waitForClipboardText();
    if (copied) {
      flashTrayIcon();
    }
  }

  soniox?.disconnect();
  soniox = null;

  hideOverlay();

  status = 'idle';
  sendStatus();
}

export function requestToggle(): void {
  if (activeTransition) return;

  const win = getOverlayWindow();
  const isVisible = win && !win.isDestroyed() && win.isVisible();

  if (isVisible) {
    if (status !== 'idle') {
      activeTransition = stopSession().finally(() => {
        activeTransition = null;
      });
    } else {
      hideOverlay();
    }
  } else {
    const settings = getSettings();
    if (!settings.sonioxApiKey) {
      showOverlay();
      sendError({
        type: 'no-api-key',
        message: 'Set up your API key in Settings to start transcribing',
        action: { label: 'Open Settings', action: 'open-settings' },
      });
      return;
    }
    clearError();
    showOverlay();
    startSession();
  }
}

export function requestQuickDismiss(): void {
  // Don't interrupt an in-progress finalization
  if (activeTransition) return;

  // Stop any active session without finalization
  if (status !== 'idle') {
    stopCapture();

    // Clear ghost text
    sendToRenderer(IpcChannels.TOKENS_NONFINAL, []);
    sendToRenderer(IpcChannels.SESSION_STOP);

    // Disconnect without waiting for finalization
    soniox?.disconnect();
    soniox = null;

    cancelReconnect();

    status = 'idle';
    sendStatus();
  }

  hideOverlay();
}

function removeHandler(channel: string, handler: ((...args: unknown[]) => void) | null): void {
  if (handler) {
    ipcMain.removeListener(channel, handler);
  }
}

export function initSessionManager(): void {
  // Reset state for re-initialization (needed for tests)
  if (soniox) {
    soniox.disconnect();
    soniox = null;
  }
  status = 'idle';
  activeTransition = null;
  currentFinalizationResolver = null;
  cancelReconnect();

  // Remove old IPC listeners to prevent double-firing on re-init
  removeHandler(IpcChannels.SESSION_REQUEST_PAUSE, pauseHandler);
  removeHandler(IpcChannels.SESSION_REQUEST_RESUME, resumeHandler);
  removeHandler(IpcChannels.SESSION_DISMISS_ERROR, dismissErrorHandler);
  removeHandler(IpcChannels.SESSION_OPEN_SETTINGS, openSettingsHandler);
  removeHandler(IpcChannels.SESSION_OPEN_MIC_SETTINGS, openMicSettingsHandler);
  removeHandler(IpcChannels.WINDOW_ESCAPE_HIDE, escapeHideHandler);

  pauseHandler = () => { pauseSession(); };
  resumeHandler = () => { resumeSession(); };
  dismissErrorHandler = () => {
    if (status === 'error' || status === 'disconnected') {
      cancelReconnect();
      soniox?.disconnect();
      soniox = null;
      status = 'idle';
      sendStatus();
      clearError();
    }
  };
  openSettingsHandler = () => { showSettings(); };
  openMicSettingsHandler = () => { shell.openExternal('ms-settings:privacy-microphone'); };

  ipcMain.on(IpcChannels.SESSION_REQUEST_PAUSE, pauseHandler);
  ipcMain.on(IpcChannels.SESSION_REQUEST_RESUME, resumeHandler);
  ipcMain.on(IpcChannels.SESSION_DISMISS_ERROR, dismissErrorHandler);
  ipcMain.on(IpcChannels.SESSION_OPEN_SETTINGS, openSettingsHandler);
  ipcMain.on(IpcChannels.SESSION_OPEN_MIC_SETTINGS, openMicSettingsHandler);

  escapeHideHandler = () => { requestQuickDismiss(); };
  ipcMain.on(IpcChannels.WINDOW_ESCAPE_HIDE, escapeHideHandler);

  if (!initialized) {
    setOverlayCloseHandler(() => {
      requestToggle();
    });
    initialized = true;
  }
}
