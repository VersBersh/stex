declare module '*.css';

interface ElectronAPI {
  hideWindow(): void;
  requestPause(): void;
  requestResume(): void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
