import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';

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
  resolveSonioxApiKey,
  APP_SETTINGS_DEFAULTS,
  getSettings,
  getSettingsForRenderer,
  setSetting,
  registerSettingsIpc,
  onSettingsChanged,
} from './settings';
import type { AppSettings } from '../shared/types';
import { IpcChannels } from '../shared/ipc';

describe('resolveSonioxApiKey', () => {
  const originalEnv = process.env.SONIOX_API_KEY;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SONIOX_API_KEY;
    } else {
      process.env.SONIOX_API_KEY = originalEnv;
    }
  });

  it('returns saved value when non-empty, ignoring env var', () => {
    process.env.SONIOX_API_KEY = 'env-key-123';
    expect(resolveSonioxApiKey('saved-key-456')).toBe('saved-key-456');
  });

  it('falls back to env var when saved value is empty', () => {
    process.env.SONIOX_API_KEY = 'env-key-123';
    expect(resolveSonioxApiKey('')).toBe('env-key-123');
  });

  it('returns empty string when neither saved value nor env var is set', () => {
    delete process.env.SONIOX_API_KEY;
    expect(resolveSonioxApiKey('')).toBe('');
  });

  it('treats whitespace-only saved value as non-empty', () => {
    process.env.SONIOX_API_KEY = 'env-key-123';
    expect(resolveSonioxApiKey('  ')).toBe('  ');
  });
});

describe('APP_SETTINGS_DEFAULTS', () => {
  it('has all AppSettings keys with correct default values', () => {
    expect(APP_SETTINGS_DEFAULTS).toEqual({
      hotkey: 'Ctrl+Shift+Space',
      launchOnStartup: false,
      onHide: 'clipboard',
      onShow: 'fresh',
      audioInputDevice: null,
      sonioxApiKey: '',
      sonioxModel: 'stt-rt-v4',
      language: 'en',
      maxEndpointDelayMs: 1000,
      theme: 'system',
      windowPosition: null,
      windowSize: { width: 600, height: 300 },
    });
  });

  it('satisfies the AppSettings type', () => {
    // TypeScript compile-time check — if APP_SETTINGS_DEFAULTS doesn't satisfy AppSettings, this won't compile
    const _check: AppSettings = APP_SETTINGS_DEFAULTS;
    expect(_check).toBeDefined();
  });
});

describe('getSettings', () => {
  const originalEnv = process.env.SONIOX_API_KEY;

  beforeEach(() => {
    mockStore.clear();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SONIOX_API_KEY;
    } else {
      process.env.SONIOX_API_KEY = originalEnv;
    }
  });

  it('returns defaults when store is empty', () => {
    delete process.env.SONIOX_API_KEY;
    const settings = getSettings();
    expect(settings.hotkey).toBe('Ctrl+Shift+Space');
    expect(settings.launchOnStartup).toBe(false);
    expect(settings.theme).toBe('system');
    expect(settings.windowSize).toEqual({ width: 600, height: 300 });
  });

  it('resolves sonioxApiKey via resolveSonioxApiKey with env var fallback', () => {
    process.env.SONIOX_API_KEY = 'env-key-abc';
    mockStore.set('sonioxApiKey', '');
    const settings = getSettings();
    expect(settings.sonioxApiKey).toBe('env-key-abc');
  });

  it('does not write resolved env var value back to the store', () => {
    process.env.SONIOX_API_KEY = 'env-key-abc';
    mockStore.set('sonioxApiKey', '');
    getSettings();
    // The raw store value should remain empty
    expect(mockStore.get('sonioxApiKey')).toBe('');
  });

  it('returns saved sonioxApiKey when non-empty, ignoring env var', () => {
    process.env.SONIOX_API_KEY = 'env-key-abc';
    mockStore.set('sonioxApiKey', 'saved-key-xyz');
    const settings = getSettings();
    expect(settings.sonioxApiKey).toBe('saved-key-xyz');
  });
});

describe('setSetting', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('updates a single setting in the store', () => {
    setSetting('hotkey', 'Alt+S');
    expect(mockStore.get('hotkey')).toBe('Alt+S');
  });

  it('does not affect other settings', () => {
    mockStore.set('theme', 'dark');
    setSetting('hotkey', 'Alt+S');
    expect(mockStore.get('theme')).toBe('dark');
  });
});

describe('onSettingsChanged', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('listener is called when setSetting is invoked', () => {
    const listener = vi.fn();
    const unsub = onSettingsChanged(listener);

    setSetting('hotkey', 'Alt+X');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ hotkey: 'Alt+X' }),
    );

    unsub();
  });

  it('unsubscribe removes the listener', () => {
    const listener = vi.fn();
    const unsub = onSettingsChanged(listener);

    setSetting('hotkey', 'Alt+X');
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();

    setSetting('hotkey', 'Alt+Y');
    expect(listener).toHaveBeenCalledTimes(1); // not called again
  });

  it('multiple listeners are all notified', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const unsub1 = onSettingsChanged(listener1);
    const unsub2 = onSettingsChanged(listener2);

    setSetting('theme', 'dark');

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);

    unsub1();
    unsub2();
  });
});

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

  it('getSettings does not leak unknown keys from store', () => {
    // Simulate a corrupted/extra key in the store
    mockStore.set('unknownExtraKey', 'should-not-appear');
    const settings = getSettings();
    expect('unknownExtraKey' in settings).toBe(false);
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

describe('API key encryption', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('setSetting encrypts sonioxApiKey before storing', () => {
    setSetting('sonioxApiKey', 'my-secret-key');
    const stored = mockStore.get('sonioxApiKey') as string;
    // Should not be the plaintext value
    expect(stored).not.toBe('my-secret-key');
    // Should be a base64 string
    expect(stored).toBeTruthy();
  });

  it('getSettings decrypts sonioxApiKey from store', () => {
    delete process.env.SONIOX_API_KEY;
    setSetting('sonioxApiKey', 'my-secret-key');
    const settings = getSettings();
    expect(settings.sonioxApiKey).toBe('my-secret-key');
  });

  it('handles legacy plaintext values gracefully (migration)', () => {
    delete process.env.SONIOX_API_KEY;
    // Simulate a legacy plaintext value directly in the store
    mockStore.set('sonioxApiKey', 'legacy-plaintext-key');
    const settings = getSettings();
    expect(settings.sonioxApiKey).toBe('legacy-plaintext-key');
  });

  it('does not encrypt non-sonioxApiKey settings', () => {
    setSetting('hotkey', 'Alt+S');
    expect(mockStore.get('hotkey')).toBe('Alt+S');
  });

  it('handles empty sonioxApiKey without encryption', () => {
    setSetting('sonioxApiKey', '');
    expect(mockStore.get('sonioxApiKey')).toBe('');
  });
});

describe('getSettingsForRenderer', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('returns masked sonioxApiKey', () => {
    delete process.env.SONIOX_API_KEY;
    setSetting('sonioxApiKey', 'my-long-api-key-abcd');
    const settings = getSettingsForRenderer();
    expect(settings.sonioxApiKey).not.toBe('my-long-api-key-abcd');
    expect(settings.sonioxApiKey).toContain('abcd');
    expect(settings.sonioxApiKey).toContain('\u2022');
  });

  it('returns empty string when no key is set', () => {
    delete process.env.SONIOX_API_KEY;
    const settings = getSettingsForRenderer();
    expect(settings.sonioxApiKey).toBe('');
  });

  it('masks short keys (4 chars or less) without bullets', () => {
    delete process.env.SONIOX_API_KEY;
    setSetting('sonioxApiKey', 'abcd');
    const settings = getSettingsForRenderer();
    expect(settings.sonioxApiKey).toBe('abcd');
  });

  it('does not affect other settings fields', () => {
    delete process.env.SONIOX_API_KEY;
    setSetting('hotkey', 'Alt+Z');
    const settings = getSettingsForRenderer();
    expect(settings.hotkey).toBe('Alt+Z');
  });

  it('masks env var fallback key', () => {
    process.env.SONIOX_API_KEY = 'env-key-from-system';
    mockStore.set('sonioxApiKey', '');
    const settings = getSettingsForRenderer();
    expect(settings.sonioxApiKey).toContain('stem');
    expect(settings.sonioxApiKey).toContain('\u2022');
    delete process.env.SONIOX_API_KEY;
  });
});
