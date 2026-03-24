import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';

const { mockStore } = vi.hoisted(() => {
  const mockStore = new Map<string, unknown>();
  return { mockStore };
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

// Mock electron with reversible safeStorage (store tests exercise encryption via setSetting/getSettings)
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  BrowserWindow: { getAllWindows: () => [] },
  safeStorage: {
    encryptString: (text: string) => Buffer.from(`enc:${text}`),
    decryptString: (buf: Buffer) => {
      const s = buf.toString();
      if (!s.startsWith('enc:')) throw new Error('decrypt failed');
      return s.slice(4);
    },
  },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn() },
}));

vi.mock('./logger', () => ({
  getLogFilePath: vi.fn(() => null),
}));

import {
  getSettings,
  setSetting,
  onSettingsChanged,
} from './settings';

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

  it('does not leak unknown keys from store', () => {
    // Simulate a corrupted/extra key in the store
    mockStore.set('unknownExtraKey', 'should-not-appear');
    const settings = getSettings();
    expect('unknownExtraKey' in settings).toBe(false);
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
