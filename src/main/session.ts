import { ipcMain, clipboard } from 'electron';
import { SonioxClient } from './soniox';
import { startCapture, stopCapture } from './audio';
import { getOverlayWindow, showOverlay, hideOverlay, setOverlayCloseHandler } from './window';
import { getSettings } from './settings';
import { IpcChannels } from '../shared/ipc';
import type { SessionState, SonioxToken } from '../shared/types';

const FINALIZATION_TIMEOUT_MS = 5000;
const CLIPBOARD_TIMEOUT_MS = 2000;

let status: SessionState['status'] = 'idle';
let soniox: SonioxClient | null = null;
let activeTransition: Promise<void> | null = null;
let currentFinalizationResolver: (() => void) | null = null;
let initialized = false;
let pauseHandler: ((...args: unknown[]) => void) | null = null;
let resumeHandler: ((...args: unknown[]) => void) | null = null;

function sendToRenderer(channel: string, ...args: unknown[]): void {
  const win = getOverlayWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}

function sendStatus(): void {
  sendToRenderer(IpcChannels.SESSION_STATUS, status);
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

function waitForClipboardText(): Promise<void> {
  return new Promise<void>((resolve) => {
    const handler = (_event: unknown, text: string) => {
      clearTimeout(timer);
      if (text && text.length > 0) {
        clipboard.writeText(text);
      }
      resolve();
    };

    const timer = setTimeout(() => {
      ipcMain.removeListener(IpcChannels.SESSION_TEXT, handler);
      resolve();
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
  status = 'error';
  sendStatus();
}

function startSession(): void {
  if (status !== 'idle') return;

  status = 'connecting';
  sendStatus();
  sendToRenderer(IpcChannels.SESSION_START);

  const settings = getSettings();

  soniox = new SonioxClient({
    onConnected: () => {
      try {
        startCapture(onAudioData, onAudioError);
      } catch (err) {
        console.error('Failed to start audio capture:', (err as Error).message);
        soniox?.disconnect();
        soniox = null;
        status = 'error';
        sendStatus();
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
    onDisconnected: (_reason: string) => {
      stopCapture();
      status = 'error';
      sendStatus();
    },
    onError: (err: Error) => {
      console.error('Soniox error:', err.message);
      stopCapture();
      status = 'error';
      sendStatus();
    },
  });

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
    status = 'error';
    sendStatus();
    return;
  }

  sendToRenderer(IpcChannels.SESSION_RESUMED);
  status = 'recording';
  sendStatus();
}

async function stopSession(): Promise<void> {
  if (status === 'idle' || status === 'finalizing') return;

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
    await waitForClipboardText();
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
    showOverlay();
    startSession();
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

  // Remove old IPC listeners to prevent double-firing on re-init
  if (pauseHandler) {
    ipcMain.removeListener(IpcChannels.SESSION_REQUEST_PAUSE, pauseHandler);
  }
  if (resumeHandler) {
    ipcMain.removeListener(IpcChannels.SESSION_REQUEST_RESUME, resumeHandler);
  }

  pauseHandler = () => { pauseSession(); };
  resumeHandler = () => { resumeSession(); };

  ipcMain.on(IpcChannels.SESSION_REQUEST_PAUSE, pauseHandler);
  ipcMain.on(IpcChannels.SESSION_REQUEST_RESUME, resumeHandler);

  if (!initialized) {
    setOverlayCloseHandler(() => {
      requestToggle();
    });
    initialized = true;
  }
}
