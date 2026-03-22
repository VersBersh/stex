declare module '*.css';

interface ElectronAPI {
  hideWindow(): void;
  requestPause(): void;
  requestResume(): void;
  getResolvedTheme(): Promise<"light" | "dark">;
  onThemeChanged(callback: (theme: "light" | "dark") => void): () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
