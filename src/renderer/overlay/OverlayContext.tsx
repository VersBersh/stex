import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import type { LexicalEditor } from 'lexical';
import { $getRoot } from 'lexical';

interface OverlayContextValue {
  confirmingClear: boolean;
  pauseRequested: boolean;
  requestClear: () => void;
  togglePauseResume: () => void;
  copyText: () => void;
  registerEditor: (editor: LexicalEditor) => void;
  registerClearHook: (hook: () => void) => () => void;
}

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function useOverlay(): OverlayContextValue {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error('useOverlay must be used within OverlayProvider');
  return ctx;
}

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [pauseRequested, setPauseRequested] = useState(false);
  const editorRef = useRef<LexicalEditor | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHooksRef = useRef<Set<() => void>>(new Set());

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
      });
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
    setPauseRequested((prev) => {
      if (prev) {
        window.electronAPI.requestResume();
      } else {
        window.electronAPI.requestPause();
      }
      return !prev;
    });
  }, []);

  const copyText = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.getEditorState().read(() => {
      const text = $getRoot().getTextContent();
      navigator.clipboard.writeText(text);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  // Window-level keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        window.electronAPI.hideWindow();
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
  }, [togglePauseResume, requestClear]);

  return (
    <OverlayContext.Provider
      value={{
        confirmingClear,
        pauseRequested,
        requestClear,
        togglePauseResume,
        copyText,
        registerEditor,
        registerClearHook,
      }}
    >
      {children}
    </OverlayContext.Provider>
  );
}
