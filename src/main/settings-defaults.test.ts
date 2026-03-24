import { describe, it, expect, afterEach, vi } from 'vitest';

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

// Mock electron — defaults tests don't exercise encryption, so stubs suffice
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  BrowserWindow: { getAllWindows: () => [] },
  safeStorage: {
    encryptString: vi.fn(),
    decryptString: vi.fn(),
  },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn() },
}));

vi.mock('./logger', () => ({
  getLogFilePath: vi.fn(() => null),
}));

import {
  resolveSonioxApiKey,
  APP_SETTINGS_DEFAULTS,
} from './settings';
import type { AppSettings } from '../shared/types';

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
      silenceThresholdDb: -30,
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
