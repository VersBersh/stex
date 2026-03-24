import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockStore, mockHandlers, mockWindows, mockShell, mockGetLogFilePath, mockExistsSync } = vi.hoisted(() => {
  const mockStore = new Map<string, unknown>();
  const mockHandlers = new Map<string, (...args: unknown[]) => unknown>();
  const mockWindows: Array<{ webContents: { send: (...args: unknown[]) => void } }> = [];
  const mockShell = {
    showItemInFolder: vi.fn(),
    openPath: vi.fn(),
  };
  const mockGetLogFilePath = vi.fn<() => string | null>(() => null);
  const mockExistsSync = vi.fn<(p: string) => boolean>(() => true);
  return { mockStore, mockHandlers, mockWindows, mockShell, mockGetLogFilePath, mockExistsSync };
});

// Mock electron-store before importing settings module
vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      private defaults: Record<string, unknown>;
      constructor(opts?: { defaults?: Record<string, unknown> }) {
        this.defaults = opts?.defaults ?? {};
        for (const [key, value] of Object.entries(this.defaults)) {
          if (!mockStore.has(key)) {
            mockStore.set(key, structuredClone(value));
          }
        }
      }
      get(key: string) {
        return mockStore.has(key) ? mockStore.get(key) : this.defaults[key];
      }
      set(keyOrObj: string | Record<string, unknown>, value?: unknown) {
        if (typeof keyOrObj === 'string') {
          mockStore.set(keyOrObj, value);
        } else {
          for (const [k, v] of Object.entries(keyOrObj)) {
            mockStore.set(k, v);
          }
        }
      }
      get store(): Record<string, unknown> {
        const obj: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(this.defaults)) {
          obj[key] = mockStore.has(key) ? mockStore.get(key) : value;
        }
        return obj;
      }
    },
  };
});

// Mock electron (including safeStorage for API key encryption)
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      mockHandlers.set(channel, handler);
    },
  },
  BrowserWindow: {
    getAllWindows: () => mockWindows,
  },
  safeStorage: {
    encryptString: (text: string) => Buffer.from(`enc:${text}`),
    decryptString: (buf: Buffer) => {
      const s = buf.toString();
      if (!s.startsWith('enc:')) throw new Error('decrypt failed');
      return s.slice(4);
    },
  },
  shell: mockShell,
}));

vi.mock('./logger', () => ({
  getLogFilePath: mockGetLogFilePath,
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return { ...actual, existsSync: mockExistsSync };
});

import {
  registerSettingsIpc,
  setSetting,
} from './settings';
import type { AppSettings } from '../shared/types';
import { IpcChannels } from '../shared/ipc';

describe('registerSettingsIpc', () => {
  beforeEach(() => {
    mockHandlers.clear();
    mockWindows.length = 0;
    mockStore.clear();
    mockShell.showItemInFolder.mockClear();
    mockShell.openPath.mockClear();
    mockGetLogFilePath.mockReset();
    mockExistsSync.mockReset().mockReturnValue(true);
  });

  it('registers handlers for SETTINGS_GET and SETTINGS_SET', () => {
    registerSettingsIpc();
    expect(mockHandlers.has(IpcChannels.SETTINGS_GET)).toBe(true);
    expect(mockHandlers.has(IpcChannels.SETTINGS_SET)).toBe(true);
  });

  it('SETTINGS_GET handler returns current settings', async () => {
    delete process.env.SONIOX_API_KEY;
    registerSettingsIpc();
    const handler = mockHandlers.get(IpcChannels.SETTINGS_GET)!;
    const result = await handler({}) as AppSettings;
    expect(result.hotkey).toBe('Ctrl+Shift+Space');
  });

  it('SETTINGS_SET handler updates setting and broadcasts to all windows', async () => {
    registerSettingsIpc();
    const mockSend = vi.fn();
    mockWindows.push({ webContents: { send: mockSend } });
    mockWindows.push({ webContents: { send: vi.fn() } });

    const handler = mockHandlers.get(IpcChannels.SETTINGS_SET)!;
    await handler({}, 'theme', 'dark');

    expect(mockStore.get('theme')).toBe('dark');
    // Both windows should receive the broadcast
    expect(mockSend).toHaveBeenCalledWith(
      IpcChannels.SETTINGS_UPDATED,
      expect.objectContaining({ theme: 'dark' }),
    );
    expect(mockWindows[1].webContents.send).toHaveBeenCalledWith(
      IpcChannels.SETTINGS_UPDATED,
      expect.objectContaining({ theme: 'dark' }),
    );
  });

  it('SETTINGS_SET handler rejects unknown keys', () => {
    registerSettingsIpc();
    const handler = mockHandlers.get(IpcChannels.SETTINGS_SET)!;
    expect(() => handler({}, 'bogusKey', 'value')).toThrow('Unknown setting key: bogusKey');
  });

  it('registers handlers for LOG_PATH_GET and LOG_REVEAL', () => {
    registerSettingsIpc();
    expect(mockHandlers.has(IpcChannels.LOG_PATH_GET)).toBe(true);
    expect(mockHandlers.has(IpcChannels.LOG_REVEAL)).toBe(true);
  });

  it('LOG_PATH_GET handler returns the log file path', async () => {
    registerSettingsIpc();
    mockGetLogFilePath.mockReturnValue('/tmp/logs/stex.log');
    const handler = mockHandlers.get(IpcChannels.LOG_PATH_GET)!;
    const result = await handler({});
    expect(result).toBe('/tmp/logs/stex.log');
  });

  it('LOG_PATH_GET handler returns null when no log file', async () => {
    registerSettingsIpc();
    mockGetLogFilePath.mockReturnValue(null);
    const handler = mockHandlers.get(IpcChannels.LOG_PATH_GET)!;
    const result = await handler({});
    expect(result).toBeNull();
  });

  it('LOG_REVEAL handler calls shell.showItemInFolder when file exists', async () => {
    registerSettingsIpc();
    mockGetLogFilePath.mockReturnValue('/tmp/logs/stex.log');
    mockExistsSync.mockReturnValue(true);
    const handler = mockHandlers.get(IpcChannels.LOG_REVEAL)!;
    await handler({});
    expect(mockShell.showItemInFolder).toHaveBeenCalledWith('/tmp/logs/stex.log');
    expect(mockShell.openPath).not.toHaveBeenCalled();
  });

  it('LOG_REVEAL handler opens directory when file does not exist', async () => {
    registerSettingsIpc();
    mockGetLogFilePath.mockReturnValue('/tmp/logs/stex.log');
    mockExistsSync.mockReturnValue(false);
    const handler = mockHandlers.get(IpcChannels.LOG_REVEAL)!;
    await handler({});
    expect(mockShell.showItemInFolder).not.toHaveBeenCalled();
    expect(mockShell.openPath).toHaveBeenCalledWith('/tmp/logs');
  });

  it('LOG_REVEAL handler is a no-op when log path is null', async () => {
    registerSettingsIpc();
    mockGetLogFilePath.mockReturnValue(null);
    const handler = mockHandlers.get(IpcChannels.LOG_REVEAL)!;
    await handler({});
    expect(mockShell.showItemInFolder).not.toHaveBeenCalled();
    expect(mockShell.openPath).not.toHaveBeenCalled();
  });

  it('SETTINGS_GET handler returns masked sonioxApiKey', async () => {
    delete process.env.SONIOX_API_KEY;
    registerSettingsIpc();
    setSetting('sonioxApiKey', 'my-secret-api-key-1234');
    const handler = mockHandlers.get(IpcChannels.SETTINGS_GET)!;
    const result = await handler({}) as AppSettings;
    // Should be masked, not plaintext
    expect(result.sonioxApiKey).not.toBe('my-secret-api-key-1234');
    expect(result.sonioxApiKey).toContain('1234');
    expect(result.sonioxApiKey).toContain('\u2022');
  });

  it('SETTINGS_SET handler broadcasts masked sonioxApiKey', async () => {
    registerSettingsIpc();
    const mockSend = vi.fn();
    mockWindows.push({ webContents: { send: mockSend } });

    const handler = mockHandlers.get(IpcChannels.SETTINGS_SET)!;
    await handler({}, 'sonioxApiKey', 'my-secret-api-key-5678');

    const broadcastedSettings = mockSend.mock.calls[0][1] as AppSettings;
    expect(broadcastedSettings.sonioxApiKey).not.toBe('my-secret-api-key-5678');
    expect(broadcastedSettings.sonioxApiKey).toContain('5678');
    expect(broadcastedSettings.sonioxApiKey).toContain('\u2022');
  });
});
