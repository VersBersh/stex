import type { AppSettings, SonioxToken, SessionState, ErrorInfo } from './types';

export interface ElectronAPI {
  // Invoke (Renderer → Main, request-response)
  settingsGet(): Promise<AppSettings>;
  settingsSet<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void>;
  getResolvedTheme(): Promise<'light' | 'dark'>;

  // Send (Renderer → Main, fire-and-forget)
  sessionRequestPause(): void;
  sessionRequestResume(): void;
  sendSessionText(text: string): void;
  hideWindow(): void;
  escapeHide(): void;
  openSettings(): void;
  openMicSettings(): void;
  dismissError(): void;

  // Listen (Main → Renderer, push events) — each returns an unsubscribe function
  onSessionStart(callback: (onShow: 'fresh' | 'append') => void): () => void;
  onSessionStop(callback: () => void): () => void;
  onSessionPaused(callback: () => void): () => void;
  onSessionResumed(callback: () => void): () => void;
  onTokensFinal(callback: (tokens: SonioxToken[]) => void): () => void;
  onTokensNonfinal(callback: (tokens: SonioxToken[]) => void): () => void;
  onSessionStatus(callback: (status: SessionState['status']) => void): () => void;
  onSettingsUpdated(callback: (settings: AppSettings) => void): () => void;
  onRequestSessionText(callback: () => void): () => void;
  onThemeChanged(callback: (theme: 'light' | 'dark') => void): () => void;
  onSessionError(callback: (error: ErrorInfo | null) => void): () => void;
}

export interface SettingsAPI {
  getSettings(): Promise<AppSettings>;
  setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void>;
  onSettingsUpdated(callback: (settings: AppSettings) => void): () => void;
  getAudioDevices(): Promise<string[]>;
  getResolvedTheme(): Promise<"light" | "dark">;
  onThemeChanged(callback: (theme: "light" | "dark") => void): () => void;
  getLogPath(): Promise<string | null>;
  revealLogFile(): Promise<void>;
}

declare global {
  interface Window {
    api: ElectronAPI;
    settingsApi: SettingsAPI;
  }
}
