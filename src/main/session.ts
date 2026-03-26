import { ipcMain } from 'electron';
import { stopCapture } from './audio';
import { getOverlayWindow, showOverlay, hideOverlay, setOverlayCloseHandler } from './window';
import { getSettings } from './settings';
import { flashTrayIcon } from './tray';
import { IpcChannels } from '../shared/ipc';
import type { SessionState, SonioxToken, ErrorInfo, ResumeAnalysisResult } from '../shared/types';
import { registerSessionIpc } from './session-ipc';
import { connectSoniox, finalizeSoniox, isConnected, hasPendingNonFinalTokens, resumeCapture, reconnectWithContext, cancelReconnect, resetLifecycle, capturePendingStartMs, getPendingStartMs, beginReplayPhase, sendReplayAudio } from './soniox-lifecycle';
import { MIN_DB } from './audio-level-monitor';
import { sendToRenderer, sendStatus, sendError, clearError } from './renderer-send';
import { copyEditorTextToClipboard } from './session-clipboard';
import { info, warn, debug } from './logger';

const FINALIZATION_TIMEOUT_MS = 5000;
const CONTEXT_FETCH_TIMEOUT_MS = 500;
const RESUME_ANALYSIS_TIMEOUT_MS = 1000;
let status: SessionState['status'] = 'idle';
let activeTransition: Promise<void> | null = null;
let currentFinalizationResolver: (() => void) | null = null;
let resumeInProgress = false;
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
      resumeInProgress = false;
      sendStatus(status);
    },
    onError: (error: ErrorInfo | null) => {
      sendError(error);
    },
    onFinalizationComplete: () => {
      currentFinalizationResolver?.();
    },
    onAudioLevel: (dB: number) => {
      sendToRenderer(IpcChannels.AUDIO_LEVEL, dB);
      if (Math.random() < 0.2) debug('Audio level → renderer: dB=%d', dB);
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

function getResumeAnalysis(): Promise<ResumeAnalysisResult> {
  return new Promise<ResumeAnalysisResult>((resolve) => {
    const handler = (_event: unknown, result: ResumeAnalysisResult) => {
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      ipcMain.removeListener(IpcChannels.SESSION_RESUME_ANALYSIS, handler);
      warn('Resume analysis timed out after %dms, treating as no edit', RESUME_ANALYSIS_TIMEOUT_MS);
      resolve({
        editorWasModified: false,
        replayAnalysis: { eligible: false, replayStartMs: null, replayGhostStartMs: null, blockedReason: 'none' },
        editorText: '',
      });
    }, RESUME_ANALYSIS_TIMEOUT_MS);

    ipcMain.once(IpcChannels.SESSION_RESUME_ANALYSIS, handler);
    sendToRenderer(IpcChannels.SESSION_RESUME_ANALYSIS);
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
  sendToRenderer(IpcChannels.AUDIO_LEVEL, MIN_DB);

  // Snapshot the start time of any unfinalized tokens before finalization
  // attempts to drain them. This is a frozen snapshot — even if finalization
  // succeeds, the committed tokens used old context and may need replay.
  capturePendingStartMs();

  if (isConnected() && hasPendingNonFinalTokens()) {
    finalizeSoniox();
    await waitForFinalization();
  }

  sendToRenderer(IpcChannels.TOKENS_NONFINAL, []);
  sendToRenderer(IpcChannels.SESSION_PAUSED);
  sendStatus(status);
}

async function resumeSession(): Promise<void> {
  if (status !== 'paused' || resumeInProgress) return;
  resumeInProgress = true;
  info('Session resuming');

  try {
    // Request resume analysis from renderer
    const { editorWasModified, replayAnalysis, editorText } = await getResumeAnalysis();

    // Check if session was cancelled during the await (e.g. user dismissed overlay)
    if (status !== 'paused') {
      resumeInProgress = false;
      return;
    }

    if (editorWasModified) {
      // Compute effective replay start
      const pendingStartMs = getPendingStartMs();
      let effectiveReplayStartMs: number | null = null;

      if (replayAnalysis.eligible) {
        effectiveReplayStartMs = pendingStartMs != null
          ? Math.min(replayAnalysis.replayStartMs!, pendingStartMs)
          : replayAnalysis.replayStartMs;
      } else {
        effectiveReplayStartMs = pendingStartMs ?? null;
      }

      const canReplay = replayAnalysis.eligible && effectiveReplayStartMs != null;

      if (canReplay) {
        info('Editor modified during pause, reconnecting with replay (ghostStart=%d, replayStart=%d)',
          replayAnalysis.replayGhostStartMs, effectiveReplayStartMs);
        beginReplayPhase();

        const ghostStartMs = replayAnalysis.replayGhostStartMs!;
        const replayStartMs = effectiveReplayStartMs!;

        reconnectWithContext(editorText, {
          replay: {
            replayStartMs,
            replayGhostStartMs: ghostStartMs,
          },
          onReady: () => {
            // Connection B is now open. Safe to convert and replay.
            sendToRenderer(IpcChannels.SESSION_REPLAY_GHOST_CONVERT, ghostStartMs);
            sendReplayAudio(replayStartMs);
          },
        });
      } else {
        info('Editor modified during pause, reconnecting with fresh context (%d chars)', editorText.length);
        reconnectWithContext(editorText);
      }
      // resumeInProgress stays true until onStatusChange fires (recording or error)
      // This prevents re-entrant resume during the websocket handshake gap
    } else {
      // No edit — reuse existing connection, just resume capture
      try {
        resumeCapture();
      } catch {
        resumeInProgress = false;
        return;
      }
      status = 'recording';
      resumeInProgress = false;
      sendStatus(status);
    }

    sendToRenderer(IpcChannels.SESSION_RESUMED);
  } catch {
    resumeInProgress = false;
  }
}

async function stopSession(): Promise<void> {
  if (status === 'idle' || status === 'finalizing') return;
  info('Session stopping');

  cancelReconnect();

  status = 'finalizing';
  sendStatus(status);

  stopCapture();
  sendToRenderer(IpcChannels.AUDIO_LEVEL, MIN_DB);

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
    sendToRenderer(IpcChannels.AUDIO_LEVEL, MIN_DB);

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
  resumeInProgress = false;

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
