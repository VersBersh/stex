import { ipcMain } from 'electron';
import { stopCapture } from './audio';
import { getOverlayWindow, showOverlay, hideOverlay, setOverlayCloseHandler } from './window';
import { getSettings } from './settings';
import { flashTrayIcon } from './tray';
import { IpcChannels } from '../shared/ipc';
import type { SessionState, SonioxToken, ErrorInfo } from '../shared/types';
import { registerSessionIpc } from './session-ipc';
import { connectSoniox, finalizeSoniox, isConnected, hasPendingNonFinalTokens, resumeCapture, cancelReconnect, resetLifecycle } from './soniox-lifecycle';
import { sendToRenderer, sendStatus, sendError, clearError } from './renderer-send';
import { copyEditorTextToClipboard } from './session-clipboard';
import { info, warn } from './logger';

const FINALIZATION_TIMEOUT_MS = 5000;
const CONTEXT_FETCH_TIMEOUT_MS = 500;
let status: SessionState['status'] = 'idle';
let activeTransition: Promise<void> | null = null;
let currentFinalizationResolver: (() => void) | null = null;
let initialized = false;

function waitForFinalization(timeoutMs = FINALIZATION_TIMEOUT_MS): Promise<void> {
  return new Promise<void>((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        currentFinalizationResolver = null;
        warn('Finalization timed out after %dms, proceeding anyway', timeoutMs);
        resolve();
      }
    }, timeoutMs);

    currentFinalizationResolver = () => {
      if (!resolved) {
        resolved = true;
        currentFinalizationResolver = null;
        clearTimeout(timer);
        info('Finalization completed');
        resolve();
      }
    };
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
      sendStatus(status);
    },
    onError: (error: ErrorInfo | null) => {
      sendError(error);
    },
    onFinalizationComplete: () => {
      currentFinalizationResolver?.();
    },
  };
}

function getEditorContextText(): Promise<string> {
  return new Promise<string>((resolve) => {
    const handler = (_event: unknown, text: string) => {
      clearTimeout(timer);
      resolve(text || '');
    };

    const timer = setTimeout(() => {
      ipcMain.removeListener(IpcChannels.SESSION_CONTEXT, handler);
      warn('Context fetch timed out after %dms, proceeding without context', CONTEXT_FETCH_TIMEOUT_MS);
      resolve('');
    }, CONTEXT_FETCH_TIMEOUT_MS);

    ipcMain.once(IpcChannels.SESSION_CONTEXT, handler);
    sendToRenderer(IpcChannels.SESSION_CONTEXT);
  });
}

async function startSession(): Promise<void> {
  if (status !== 'idle') return;
  info('Session starting');

  status = 'connecting';
  sendStatus(status);

  const settings = getSettings();

  let contextText: string | undefined;
  if (settings.onShow === 'append') {
    contextText = await getEditorContextText() || undefined;
    // Check if session was cancelled during the await (e.g., quick dismiss)
    if (status !== 'connecting') return;
    if (contextText) {
      info('Context: %d chars of preceding text', contextText.length);
    }
  }

  sendToRenderer(IpcChannels.SESSION_START, settings.onShow);
  connectSoniox(createLifecycleCallbacks(), contextText);
}

async function pauseSession(): Promise<void> {
  if (status !== 'recording') return;
  info('Session pausing');

  status = 'paused';

  stopCapture();
  finalizeSoniox();

  await waitForFinalization();

  sendToRenderer(IpcChannels.TOKENS_NONFINAL, []);
  sendToRenderer(IpcChannels.SESSION_PAUSED);
  sendStatus(status);
}

function resumeSession(): void {
  if (status !== 'paused') return;
  info('Session resuming');

  try {
    resumeCapture();
  } catch {
    // Error already reported to callbacks by resumeCapture
    return;
  }

  sendToRenderer(IpcChannels.SESSION_RESUMED);
  status = 'recording';
  sendStatus(status);
}

async function stopSession(): Promise<void> {
  if (status === 'idle' || status === 'finalizing') return;
  info('Session stopping');

  cancelReconnect();

  status = 'finalizing';
  sendStatus(status);

  stopCapture();

  if (isConnected() && hasPendingNonFinalTokens()) {
    finalizeSoniox();
    await waitForFinalization();
  }

  sendToRenderer(IpcChannels.TOKENS_NONFINAL, []);
  sendToRenderer(IpcChannels.SESSION_STOP);

  const settings = getSettings();
  if (settings.onHide === 'clipboard') {
    const copied = await copyEditorTextToClipboard(sendToRenderer);
    if (copied) {
      flashTrayIcon();
    }
  }

  resetLifecycle();

  hideOverlay();

  status = 'idle';
  sendStatus(status);
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
    sendStatus(status);
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
      if (status === 'error') {
        cancelReconnect();
        resetLifecycle();
        status = 'idle';
        sendStatus(status);
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
