declare module '*.css';

import type { ErrorInfo } from '../shared/types';

interface ElectronAPI {
  hideWindow(): void;
  requestPause(): void;
  requestResume(): void;
  openSettings(): void;
  openMicSettings(): void;
  dismissError(): void;
  getResolvedTheme(): Promise<"light" | "dark">;
  onThemeChanged(callback: (theme: "light" | "dark") => void): () => void;
  onSessionStatus(callback: (status: string) => void): () => void;
  onSessionError(callback: (error: ErrorInfo) => void): () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
