import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import type { LexicalEditor } from 'lexical';
import { $getRoot } from 'lexical';
import { createPauseController } from './pauseController';
import type { ErrorInfo, SessionState } from '../../shared/types';
import { createSessionLifecycleController } from './sessionLifecycleController';

interface OverlayContextValue {
  confirmingClear: boolean;
  paused: boolean;
  sessionStatus: SessionState['status'];
  error: ErrorInfo | null;
  requestClear: () => void;
  togglePauseResume: () => void;
  copyText: () => void;
  registerEditor: (editor: LexicalEditor) => void;
  registerClearHook: (hook: () => void) => () => void;
  dismissError: () => void;
  handleErrorAction: () => void;
}

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function useOverlay(): OverlayContextValue {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error('useOverlay must be used within OverlayProvider');
  return ctx;
}

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [paused, setPaused] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<SessionState['status']>('idle');
  const [error, setError] = useState<ErrorInfo | null>(null);
  const editorRef = useRef<LexicalEditor | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHooksRef = useRef<Set<() => void>>(new Set());
  const controllerRef = useRef<ReturnType<typeof createPauseController> | null>(null);

  const registerEditor = useCallback((editor: LexicalEditor) => {
    editorRef.current = editor;
  }, []);

  const registerClearHook = useCallback((hook: () => void): (() => void) => {
    clearHooksRef.current.add(hook);
    return () => { clearHooksRef.current.delete(hook); };
  }, []);

  const clearEditor = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      editor.update(() => {
        $getRoot().clear();
      }, { discrete: true });
    }
    clearHooksRef.current.forEach((hook) => hook());
  }, []);

  const isEditorEmpty = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return true;
    let empty = true;
    editor.getEditorState().read(() => {
      const text = $getRoot().getTextContent();
      empty = text.trim().length === 0;
    });
    return empty;
  }, []);

  const requestClear = useCallback(() => {
    if (confirmingClear) {
      clearEditor();
      setConfirmingClear(false);
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
    } else if (isEditorEmpty()) {
      // Nothing to clear — no confirmation needed
      return;
    } else {
      setConfirmingClear(true);
      clearTimerRef.current = setTimeout(() => {
        setConfirmingClear(false);
        clearTimerRef.current = null;
      }, 3000);
    }
  }, [confirmingClear, clearEditor, isEditorEmpty]);

  const togglePauseResume = useCallback(() => {
    // Only allow pause/resume in valid states
    if (sessionStatus === 'recording' || sessionStatus === 'paused') {
      controllerRef.current?.toggle();
    }
    // No-op in other states (disconnected, reconnecting, error, etc.)
  }, [sessionStatus]);

  const copyText = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.getEditorState().read(() => {
      const text = $getRoot().getTextContent();
      navigator.clipboard.writeText(text);
    });
  }, []);

  const dismissError = useCallback(() => {
    window.api.dismissError();
    setError(null);
  }, []);

  const handleErrorAction = useCallback(() => {
    if (!error?.action) return;
    const action = error.action.action;
    if (action === 'open-settings') {
      window.api.openSettings();
    } else if (action === 'open-mic-settings') {
      window.api.openMicSettings();
    }
  }, [error]);

  // Subscribe to session status changes from main process
  useEffect(() => {
    return window.api.onSessionStatus((newStatus) => {
      setSessionStatus(newStatus as SessionState['status']);
    });
  }, []);

  // Subscribe to session error events from main process
  // null signals error cleared (recovery)
  useEffect(() => {
    return window.api.onSessionError((errorInfo) => {
      setError(errorInfo ?? null);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const controller = createPauseController(window.api);
    controllerRef.current = controller;
    const unsub = controller.subscribe(setPaused);
    return () => {
      unsub();
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const controller = createSessionLifecycleController(window.api, clearEditor);
    return () => controller.destroy();
  }, [clearEditor]);

  // Respond to main process text requests for clipboard copy
  useEffect(() => {
    return window.api.onRequestSessionText(() => {
      const editor = editorRef.current;
      if (!editor) {
        window.api.sendSessionText('');
        return;
      }
      editor.getEditorState().read(() => {
        const text = $getRoot().getTextContent();
        window.api.sendSessionText(text);
      });
    });
  }, []);


  // Window-level keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        window.api.escapeHide();
        return;
      }

      if (e.ctrlKey && e.key === 'c') {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          e.preventDefault();
          copyText();
        }
        // If text is selected, let default browser Ctrl+C handle it
        return;
      }

      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        togglePauseResume();
        return;
      }

      if (e.ctrlKey && e.shiftKey && e.key === 'Backspace') {
        e.preventDefault();
        requestClear();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePauseResume, requestClear, copyText]);

  return (
    <OverlayContext.Provider
      value={{
        confirmingClear,
        paused,
        sessionStatus,
        error,
        requestClear,
        togglePauseResume,
        copyText,
        registerEditor,
        registerClearHook,
        dismissError,
        handleErrorAction,
      }}
    >
      {children}
    </OverlayContext.Provider>
  );
}
