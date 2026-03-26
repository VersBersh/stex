import type { AppSettings, SonioxToken, SessionState, ErrorInfo, ResumeAnalysisResult } from './types';

export interface ElectronAPI {
  // Invoke (Renderer → Main, request-response)
  settingsGet(): Promise<AppSettings>;
  settingsSet<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void>;
  getResolvedTheme(): Promise<'light' | 'dark'>;

  // Send (Renderer → Main, fire-and-forget)
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void;
  sessionRequestPause(): void;
  sessionRequestResume(): void;
  sendSessionText(text: string): void;
  sendContextText(text: string): void;
  sendResumeAnalysis(result: ResumeAnalysisResult): void;
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
  onRequestContextText(callback: () => void): () => void;
  onRequestResumeAnalysis(callback: () => void): () => void;
  onThemeChanged(callback: (theme: 'light' | 'dark') => void): () => void;
  onSessionError(callback: (error: ErrorInfo | null) => void): () => void;
  onAudioLevel(callback: (dB: number) => void): () => void;
  onReplayGhostConvert(callback: (replayGhostStartMs: number) => void): () => void;

  // Audio capture (Main → Renderer commands, Renderer → Main data)
  onAudioStartCapture(callback: (deviceName: string | null) => void): () => void;
  onAudioStopCapture(callback: () => void): () => void;
  sendAudioChunk(buffer: ArrayBuffer): void;
  sendAudioCaptureError(message: string): void;
}

export interface AudioDeviceResult {
  devices: string[];
  labelsUnavailable: boolean;
}

export interface SettingsAPI {
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void;
  getSettings(): Promise<AppSettings>;
  setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void>;
  onSettingsUpdated(callback: (settings: AppSettings) => void): () => void;
  getAudioDevices(): Promise<AudioDeviceResult>;
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
