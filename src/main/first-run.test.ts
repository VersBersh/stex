import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Mock setup via vi.hoisted ---
const {
  mockSettingsData,
  mockShowSettings,
  mockRegisterSettingsIpc,
  mockRegisterAudioIpc,
  mockInitThemeManager,
  mockInitWindowManager,
  mockInitSessionManager,
  mockInitTray,
  mockInitHotkeyManager,
} = vi.hoisted(() => {
  const mockSettingsData: Record<string, unknown> = { sonioxApiKey: '' };
  const mockShowSettings = vi.fn();
  const mockRegisterSettingsIpc = vi.fn();
  const mockRegisterAudioIpc = vi.fn();
  const mockInitThemeManager = vi.fn();
  const mockInitWindowManager = vi.fn();
  const mockInitSessionManager = vi.fn();
  const mockInitTray = vi.fn();
  const mockInitHotkeyManager = vi.fn();
  return {
    mockSettingsData,
    mockShowSettings,
    mockRegisterSettingsIpc,
    mockRegisterAudioIpc,
    mockInitThemeManager,
    mockInitWindowManager,
    mockInitSessionManager,
    mockInitTray,
    mockInitHotkeyManager,
  };
});

// --- Mock electron ---
vi.mock('electron', () => ({
  app: {
    whenReady: () => Promise.resolve(),
    on: vi.fn(),
  },
}));

// --- Mock settings ---
vi.mock('./settings', () => ({
  getSettings: () => ({ ...mockSettingsData }),
  registerSettingsIpc: (...args: unknown[]) => mockRegisterSettingsIpc(...args),
}));

// --- Mock window ---
vi.mock('./window', () => ({
  initWindowManager: (...args: unknown[]) => mockInitWindowManager(...args),
  showSettings: (...args: unknown[]) => mockShowSettings(...args),
}));

// --- Mock other managers ---
vi.mock('./audio', () => ({
  registerAudioIpc: (...args: unknown[]) => mockRegisterAudioIpc(...args),
}));

vi.mock('./theme', () => ({
  initThemeManager: (...args: unknown[]) => mockInitThemeManager(...args),
}));

vi.mock('./session', () => ({
  initSessionManager: (...args: unknown[]) => mockInitSessionManager(...args),
}));

vi.mock('./tray', () => ({
  initTray: (...args: unknown[]) => mockInitTray(...args),
}));

vi.mock('./hotkey', () => ({
  initHotkeyManager: (...args: unknown[]) => mockInitHotkeyManager(...args),
}));

import { initApp } from './index';

describe('First-run experience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsData.sonioxApiKey = '';
  });

  it('opens settings when API key is empty', () => {
    mockSettingsData.sonioxApiKey = '';
    initApp();
    expect(mockShowSettings).toHaveBeenCalledOnce();
  });

  it('does not open settings when API key exists', () => {
    mockSettingsData.sonioxApiKey = 'test-key-123';
    initApp();
    expect(mockShowSettings).not.toHaveBeenCalled();
  });

  it('does not open settings when API key comes from env var (via getSettings)', () => {
    // getSettings() is mocked here — actual env-var resolution is tested in
    // settings.test.ts ("resolves sonioxApiKey via resolveSonioxApiKey with env var fallback").
    // This test documents that initApp() treats env-var-resolved keys as "available".
    mockSettingsData.sonioxApiKey = 'env-resolved-key';
    initApp();
    expect(mockShowSettings).not.toHaveBeenCalled();
  });

  it('initializes all managers regardless of API key state', () => {
    mockSettingsData.sonioxApiKey = '';
    initApp();

    expect(mockRegisterSettingsIpc).toHaveBeenCalledOnce();
    expect(mockRegisterAudioIpc).toHaveBeenCalledOnce();
    expect(mockInitThemeManager).toHaveBeenCalledOnce();
    expect(mockInitWindowManager).toHaveBeenCalledOnce();
    expect(mockInitSessionManager).toHaveBeenCalledOnce();
    expect(mockInitTray).toHaveBeenCalledOnce();
    expect(mockInitHotkeyManager).toHaveBeenCalledOnce();
  });

  it('initializes all managers when API key exists', () => {
    mockSettingsData.sonioxApiKey = 'test-key-123';
    initApp();

    expect(mockRegisterSettingsIpc).toHaveBeenCalledOnce();
    expect(mockRegisterAudioIpc).toHaveBeenCalledOnce();
    expect(mockInitThemeManager).toHaveBeenCalledOnce();
    expect(mockInitWindowManager).toHaveBeenCalledOnce();
    expect(mockInitSessionManager).toHaveBeenCalledOnce();
    expect(mockInitTray).toHaveBeenCalledOnce();
    expect(mockInitHotkeyManager).toHaveBeenCalledOnce();
  });
});
