import { describe, it, expect, vi, beforeEach } from 'vitest';

const { exposed, mockInvoke, mockOn, mockRemoveListener } = vi.hoisted(() => {
  const exposed: { settingsApi: Record<string, unknown> | null } = { settingsApi: null };
  const mockInvoke = vi.fn();
  const mockOn = vi.fn();
  const mockRemoveListener = vi.fn();
  return { exposed, mockInvoke, mockOn, mockRemoveListener };
});

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (_key: string, api: Record<string, unknown>) => {
      exposed.settingsApi = api;
    },
  },
  ipcRenderer: {
    invoke: mockInvoke,
    on: mockOn,
    removeListener: mockRemoveListener,
  },
}));

describe('Settings preload bridge', () => {
  beforeEach(async () => {
    exposed.settingsApi = null;
    mockInvoke.mockClear();
    mockOn.mockClear();
    mockRemoveListener.mockClear();
    vi.resetModules();
    await import('./settings-preload');
  });

  it('exposes a settingsApi object on window', () => {
    expect(exposed.settingsApi).not.toBeNull();
  });

  describe('invoke methods (Renderer → Main, request-response)', () => {
    it('exposes getSettings', () => {
      const api = exposed.settingsApi as Record<string, (...args: unknown[]) => unknown>;
      expect(typeof api.getSettings).toBe('function');
    });

    it('getSettings calls ipcRenderer.invoke with correct channel', async () => {
      const api = exposed.settingsApi as Record<string, (...args: unknown[]) => unknown>;
      mockInvoke.mockResolvedValue({ hotkey: 'Ctrl+Shift+Space' });
      await api.getSettings();
      expect(mockInvoke).toHaveBeenCalledWith('settings:get');
    });

    it('exposes setSetting', () => {
      const api = exposed.settingsApi as Record<string, (...args: unknown[]) => unknown>;
      expect(typeof api.setSetting).toBe('function');
    });

    it('setSetting calls ipcRenderer.invoke with key and value', async () => {
      const api = exposed.settingsApi as Record<string, (...args: unknown[]) => unknown>;
      await api.setSetting('theme', 'dark');
      expect(mockInvoke).toHaveBeenCalledWith('settings:set', 'theme', 'dark');
    });

    it('exposes getAudioDevices', () => {
      const api = exposed.settingsApi as Record<string, (...args: unknown[]) => unknown>;
      expect(typeof api.getAudioDevices).toBe('function');
    });

    it('getAudioDevices calls ipcRenderer.invoke with correct channel', async () => {
      const api = exposed.settingsApi as Record<string, (...args: unknown[]) => unknown>;
      mockInvoke.mockResolvedValue(['Microphone 1', 'Microphone 2']);
      await api.getAudioDevices();
      expect(mockInvoke).toHaveBeenCalledWith('audio:get-devices');
    });

    it('exposes getResolvedTheme', () => {
      const api = exposed.settingsApi as Record<string, (...args: unknown[]) => unknown>;
      expect(typeof api.getResolvedTheme).toBe('function');
    });

    it('getResolvedTheme calls ipcRenderer.invoke with correct channel', async () => {
      const api = exposed.settingsApi as Record<string, (...args: unknown[]) => unknown>;
      mockInvoke.mockResolvedValue('dark');
      await api.getResolvedTheme();
      expect(mockInvoke).toHaveBeenCalledWith('theme:get');
    });

    it('exposes getLogPath', () => {
      const api = exposed.settingsApi as Record<string, (...args: unknown[]) => unknown>;
      expect(typeof api.getLogPath).toBe('function');
    });

    it('getLogPath calls ipcRenderer.invoke with correct channel', async () => {
      const api = exposed.settingsApi as Record<string, (...args: unknown[]) => unknown>;
      mockInvoke.mockResolvedValue('/tmp/logs/stex.log');
      await api.getLogPath();
      expect(mockInvoke).toHaveBeenCalledWith('log:get-path');
    });

    it('exposes revealLogFile', () => {
      const api = exposed.settingsApi as Record<string, (...args: unknown[]) => unknown>;
      expect(typeof api.revealLogFile).toBe('function');
    });

    it('revealLogFile calls ipcRenderer.invoke with correct channel', async () => {
      const api = exposed.settingsApi as Record<string, (...args: unknown[]) => unknown>;
      await api.revealLogFile();
      expect(mockInvoke).toHaveBeenCalledWith('log:reveal');
    });
  });

  describe('listener methods (Main → Renderer, push events)', () => {
    it('exposes onSettingsUpdated', () => {
      const api = exposed.settingsApi as Record<string, (...args: unknown[]) => unknown>;
      expect(typeof api.onSettingsUpdated).toBe('function');
    });

    it('onSettingsUpdated registers listener via ipcRenderer.on', () => {
      const api = exposed.settingsApi as Record<string, (...args: unknown[]) => unknown>;
      const callback = vi.fn();
      api.onSettingsUpdated(callback);
      expect(mockOn).toHaveBeenCalledWith('settings:updated', expect.any(Function));
    });

    it('listener returns an unsubscribe function', () => {
      const api = exposed.settingsApi as Record<string, (...args: unknown[]) => unknown>;
      const callback = vi.fn();
      const unsubscribe = api.onSettingsUpdated(callback) as () => void;
      expect(typeof unsubscribe).toBe('function');
    });

    it('unsubscribe calls ipcRenderer.removeListener', () => {
      const api = exposed.settingsApi as Record<string, (...args: unknown[]) => unknown>;
      const callback = vi.fn();
      const unsubscribe = api.onSettingsUpdated(callback) as () => void;
      unsubscribe();
      expect(mockRemoveListener).toHaveBeenCalledWith('settings:updated', expect.any(Function));
    });

    it('listener callback receives unwrapped data (strips IpcRendererEvent)', () => {
      const api = exposed.settingsApi as Record<string, (...args: unknown[]) => unknown>;
      const callback = vi.fn();
      api.onSettingsUpdated(callback);
      // Get the wrapper function that was registered
      const wrapper = mockOn.mock.calls.find(
        (call: unknown[]) => call[0] === 'settings:updated',
      )![1] as (...args: unknown[]) => void;
      // Simulate ipcRenderer calling the wrapper with (event, data)
      const fakeEvent = {};
      const fakeData = { hotkey: 'Alt+S' };
      wrapper(fakeEvent, fakeData);
      expect(callback).toHaveBeenCalledWith(fakeData);
    });

    it('exposes onThemeChanged', () => {
      const api = exposed.settingsApi as Record<string, (...args: unknown[]) => unknown>;
      expect(typeof api.onThemeChanged).toBe('function');
    });

    it('onThemeChanged registers listener via ipcRenderer.on', () => {
      const api = exposed.settingsApi as Record<string, (...args: unknown[]) => unknown>;
      const callback = vi.fn();
      api.onThemeChanged(callback);
      expect(mockOn).toHaveBeenCalledWith('theme:resolved', expect.any(Function));
    });

    it('onThemeChanged unsubscribe calls ipcRenderer.removeListener', () => {
      const api = exposed.settingsApi as Record<string, (...args: unknown[]) => unknown>;
      const callback = vi.fn();
      const unsubscribe = api.onThemeChanged(callback) as () => void;
      unsubscribe();
      expect(mockRemoveListener).toHaveBeenCalledWith('theme:resolved', expect.any(Function));
    });
  });
});
