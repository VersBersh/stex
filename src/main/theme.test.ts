import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  mockShouldUseDarkColors,
  mockNativeThemeListeners,
  mockSettingsData,
  mockSettingsListeners,
  mockIpcHandlers,
  mockWindows,
} = vi.hoisted(() => {
  const mockShouldUseDarkColors = { value: false };
  const mockNativeThemeListeners = new Map<string, Array<() => void>>();
  const mockSettingsData: Record<string, unknown> = {};
  const mockSettingsListeners: Array<(settings: unknown) => void> = [];
  const mockIpcHandlers = new Map<string, (...args: unknown[]) => unknown>();
  const mockWindows: Array<{ webContents: { send: ReturnType<typeof vi.fn> } }> = [];
  return {
    mockShouldUseDarkColors,
    mockNativeThemeListeners,
    mockSettingsData,
    mockSettingsListeners,
    mockIpcHandlers,
    mockWindows,
  };
});

vi.mock('electron', () => ({
  nativeTheme: {
    get shouldUseDarkColors() {
      return mockShouldUseDarkColors.value;
    },
    on: (event: string, handler: () => void) => {
      if (!mockNativeThemeListeners.has(event)) {
        mockNativeThemeListeners.set(event, []);
      }
      mockNativeThemeListeners.get(event)!.push(handler);
    },
  },
  BrowserWindow: {
    getAllWindows: () => mockWindows,
  },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      mockIpcHandlers.set(channel, handler);
    },
  },
}));

vi.mock('./settings', () => ({
  getSettings: () => ({
    theme: mockSettingsData.theme ?? 'system',
  }),
  onSettingsChanged: (listener: (settings: unknown) => void) => {
    mockSettingsListeners.push(listener);
    return () => {
      const idx = mockSettingsListeners.indexOf(listener);
      if (idx >= 0) mockSettingsListeners.splice(idx, 1);
    };
  },
}));

import { resolveTheme, initThemeManager, _resetForTesting } from './theme';
import { IpcChannels } from '../shared/ipc';

describe('resolveTheme', () => {
  beforeEach(() => {
    mockShouldUseDarkColors.value = false;
    mockSettingsData.theme = 'system';
  });

  it('returns "light" when setting is "light"', () => {
    mockSettingsData.theme = 'light';
    expect(resolveTheme()).toBe('light');
  });

  it('returns "dark" when setting is "dark"', () => {
    mockSettingsData.theme = 'dark';
    expect(resolveTheme()).toBe('dark');
  });

  it('returns "light" when setting is "light" regardless of OS dark mode', () => {
    mockSettingsData.theme = 'light';
    mockShouldUseDarkColors.value = true;
    expect(resolveTheme()).toBe('light');
  });

  it('returns "dark" when setting is "dark" regardless of OS light mode', () => {
    mockSettingsData.theme = 'dark';
    mockShouldUseDarkColors.value = false;
    expect(resolveTheme()).toBe('dark');
  });

  it('returns "dark" when setting is "system" and OS is dark', () => {
    mockSettingsData.theme = 'system';
    mockShouldUseDarkColors.value = true;
    expect(resolveTheme()).toBe('dark');
  });

  it('returns "light" when setting is "system" and OS is light', () => {
    mockSettingsData.theme = 'system';
    mockShouldUseDarkColors.value = false;
    expect(resolveTheme()).toBe('light');
  });
});

describe('initThemeManager', () => {
  beforeEach(() => {
    _resetForTesting();
    mockShouldUseDarkColors.value = false;
    mockSettingsData.theme = 'system';
    mockNativeThemeListeners.clear();
    mockSettingsListeners.length = 0;
    mockIpcHandlers.clear();
    mockWindows.length = 0;
  });

  it('registers ipcMain.handle for THEME_GET', () => {
    initThemeManager();
    expect(mockIpcHandlers.has(IpcChannels.THEME_GET)).toBe(true);
  });

  it('THEME_GET handler returns resolved theme', () => {
    mockSettingsData.theme = 'dark';
    initThemeManager();
    const handler = mockIpcHandlers.get(IpcChannels.THEME_GET)!;
    expect(handler()).toBe('dark');
  });

  it('broadcasts to all windows when theme setting changes', () => {
    mockSettingsData.theme = 'light';
    initThemeManager();

    const mockSend = vi.fn();
    mockWindows.push({ webContents: { send: mockSend } });

    // Change setting to dark
    mockSettingsData.theme = 'dark';
    for (const listener of mockSettingsListeners) {
      listener({ theme: 'dark' });
    }

    expect(mockSend).toHaveBeenCalledWith(IpcChannels.THEME_RESOLVED, 'dark');
  });

  it('does NOT broadcast when resolved theme has not changed', () => {
    mockSettingsData.theme = 'light';
    initThemeManager();

    const mockSend = vi.fn();
    mockWindows.push({ webContents: { send: mockSend } });

    // Change an unrelated setting — theme stays 'light'
    for (const listener of mockSettingsListeners) {
      listener({ theme: 'light' });
    }

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('broadcasts on nativeTheme updated when setting is "system" and theme changes', () => {
    mockSettingsData.theme = 'system';
    mockShouldUseDarkColors.value = false;
    initThemeManager();

    const mockSend = vi.fn();
    mockWindows.push({ webContents: { send: mockSend } });

    // OS switches to dark
    mockShouldUseDarkColors.value = true;
    const listeners = mockNativeThemeListeners.get('updated') ?? [];
    for (const listener of listeners) {
      listener();
    }

    expect(mockSend).toHaveBeenCalledWith(IpcChannels.THEME_RESOLVED, 'dark');
  });

  it('does NOT broadcast on nativeTheme updated when setting is explicit "light"', () => {
    mockSettingsData.theme = 'light';
    mockShouldUseDarkColors.value = false;
    initThemeManager();

    const mockSend = vi.fn();
    mockWindows.push({ webContents: { send: mockSend } });

    // OS switches to dark but setting is explicit 'light'
    mockShouldUseDarkColors.value = true;
    const listeners = mockNativeThemeListeners.get('updated') ?? [];
    for (const listener of listeners) {
      listener();
    }

    // Resolved theme is still 'light' — no broadcast
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('broadcasts to multiple windows', () => {
    mockSettingsData.theme = 'light';
    initThemeManager();

    const mockSend1 = vi.fn();
    const mockSend2 = vi.fn();
    mockWindows.push({ webContents: { send: mockSend1 } });
    mockWindows.push({ webContents: { send: mockSend2 } });

    mockSettingsData.theme = 'dark';
    for (const listener of mockSettingsListeners) {
      listener({ theme: 'dark' });
    }

    expect(mockSend1).toHaveBeenCalledWith(IpcChannels.THEME_RESOLVED, 'dark');
    expect(mockSend2).toHaveBeenCalledWith(IpcChannels.THEME_RESOLVED, 'dark');
  });
});
