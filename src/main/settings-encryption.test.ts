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

// Mock electron with reversible safeStorage (encryption tests exercise encrypt/decrypt)
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
  setSetting,
  getSettings,
  getSettingsForRenderer,
} from './settings';

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
  });
});
