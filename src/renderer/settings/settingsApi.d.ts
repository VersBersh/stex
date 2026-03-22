import type { AppSettings } from '../../shared/types';

interface SettingsApi {
  getSettings(): Promise<AppSettings>;
  setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void>;
  onSettingsUpdated(callback: (settings: AppSettings) => void): () => void;
  getAudioDevices(): Promise<string[]>;
}

declare global {
  interface Window {
    settingsApi: SettingsApi;
  }
}

export {};
