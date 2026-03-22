import { ipcMain, clipboard } from 'electron';
import { stopCapture } from './audio';
import { getOverlayWindow, showOverlay, hideOverlay, setOverlayCloseHandler } from './window';
import { getSettings } from './settings';
import { flashTrayIcon } from './tray';
import { IpcChannels } from '../shared/ipc';
import type { SessionState, SonioxToken, ErrorInfo } from '../shared/types';
import { registerSessionIpc } from './session-ipc';
import { connectSoniox, finalizeSoniox, isConnected, resumeCapture, cancelReconnect, resetLifecycle } from './soniox-lifecycle';

const FINALIZATION_TIMEOUT_MS = 5000;
const CLIPBOARD_TIMEOUT_MS = 2000;
let status: SessionState['status'] = 'idle';
let activeTransition: Promise<void> | null = null;
let currentFinalizationResolver: (() => void) | null = null;
let initialized = false;

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

function clearError(): void {
  sendError(null);
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

function createLifecycleCallbacks() {
  return {
    onFinalTokens: (tokens: SonioxToken[]) => {
      sendToRenderer(IpcChannels.TOKENS_FINAL, tokens);
    },
    onNonFinalTokens: (tokens: SonioxToken[]) => {
      sendToRenderer(IpcChannels.TOKENS_NONFINAL, tokens);
    },
    onStatusChange: (newStatus: SessionState['status']) => {
      status = newStatus;
      sendStatus();
    },
    onError: (error: ErrorInfo | null) => {
      sendError(error);
    },
    onFinalizationComplete: () => {
      currentFinalizationResolver?.();
    },
  };
}

function startSession(): void {
  if (status !== 'idle') return;

  status = 'connecting';
  sendStatus();

  const settings = getSettings();
  sendToRenderer(IpcChannels.SESSION_START, settings.onShow);
  connectSoniox(createLifecycleCallbacks());
}

async function pauseSession(): Promise<void> {
  if (status !== 'recording') return;

  status = 'paused';

  stopCapture();
  finalizeSoniox();

  await waitForFinalization();

  sendToRenderer(IpcChannels.TOKENS_NONFINAL, []);
  sendToRenderer(IpcChannels.SESSION_PAUSED);
  sendStatus();
}

function resumeSession(): void {
  if (status !== 'paused') return;

  try {
    resumeCapture();
  } catch {
    // Error already reported to callbacks by resumeCapture
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

  if (isConnected()) {
    finalizeSoniox();
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

  resetLifecycle();

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
  if (activeTransition) return;

  if (status !== 'idle') {
    stopCapture();

    sendToRenderer(IpcChannels.TOKENS_NONFINAL, []);
    sendToRenderer(IpcChannels.SESSION_STOP);

    resetLifecycle();

    status = 'idle';
    sendStatus();
  }

  hideOverlay();
}

export function initSessionManager(): void {
  resetLifecycle();
  status = 'idle';
  activeTransition = null;
  currentFinalizationResolver = null;

  registerSessionIpc({
    onPause: () => { pauseSession(); },
    onResume: () => { resumeSession(); },
    onDismissError: () => {
      if (status === 'error' || status === 'disconnected') {
        cancelReconnect();
        resetLifecycle();
        status = 'idle';
        sendStatus();
        clearError();
      }
    },
    onEscapeHide: () => { requestQuickDismiss(); },
  });

  if (!initialized) {
    setOverlayCloseHandler(() => {
      requestToggle();
    });
    initialized = true;
  }
}
