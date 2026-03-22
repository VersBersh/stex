import { describe, it, expect, vi, beforeEach } from 'vitest';

const { exposed, mockInvoke, mockSend, mockOn, mockRemoveListener } = vi.hoisted(() => {
  const exposed: { api: Record<string, unknown> | null } = { api: null };
  const mockInvoke = vi.fn();
  const mockSend = vi.fn();
  const mockOn = vi.fn();
  const mockRemoveListener = vi.fn();
  return { exposed, mockInvoke, mockSend, mockOn, mockRemoveListener };
});

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (_key: string, api: Record<string, unknown>) => {
      exposed.api = api;
    },
  },
  ipcRenderer: {
    invoke: mockInvoke,
    send: mockSend,
    on: mockOn,
    removeListener: mockRemoveListener,
  },
}));

describe('Preload bridge', () => {
  beforeEach(async () => {
    exposed.api = null;
    mockInvoke.mockClear();
    mockSend.mockClear();
    mockOn.mockClear();
    mockRemoveListener.mockClear();
    vi.resetModules();
    await import('./index');
  });

  it('exposes an api object on window', () => {
    expect(exposed.api).not.toBeNull();
  });

  describe('invoke methods (Renderer → Main, request-response)', () => {
    it('exposes settingsGet', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      expect(typeof api.settingsGet).toBe('function');
    });

    it('settingsGet calls ipcRenderer.invoke with correct channel', async () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      mockInvoke.mockResolvedValue({ hotkey: 'Ctrl+Shift+Space' });
      await api.settingsGet();
      expect(mockInvoke).toHaveBeenCalledWith('settings:get');
    });

    it('exposes settingsSet', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      expect(typeof api.settingsSet).toBe('function');
    });

    it('settingsSet calls ipcRenderer.invoke with key and value', async () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      await api.settingsSet('theme', 'dark');
      expect(mockInvoke).toHaveBeenCalledWith('settings:set', 'theme', 'dark');
    });
  });

  describe('send methods (Renderer → Main, fire-and-forget)', () => {
    it('exposes sessionRequestPause', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      expect(typeof api.sessionRequestPause).toBe('function');
    });

    it('sessionRequestPause calls ipcRenderer.send', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      api.sessionRequestPause();
      expect(mockSend).toHaveBeenCalledWith('session:request-pause');
    });

    it('exposes sessionRequestResume', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      expect(typeof api.sessionRequestResume).toBe('function');
    });

    it('sessionRequestResume calls ipcRenderer.send', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      api.sessionRequestResume();
      expect(mockSend).toHaveBeenCalledWith('session:request-resume');
    });

    it('exposes sendSessionText', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      expect(typeof api.sendSessionText).toBe('function');
    });

    it('sendSessionText calls ipcRenderer.send with text', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      api.sendSessionText('hello world');
      expect(mockSend).toHaveBeenCalledWith('session:text', 'hello world');
    });
  });

  describe('listener methods (Main → Renderer, push events)', () => {
    const listenerMethods = [
      'onSessionStart',
      'onSessionStop',
      'onSessionPaused',
      'onSessionResumed',
      'onTokensFinal',
      'onTokensNonfinal',
      'onSessionStatus',
      'onSettingsUpdated',
    ];

    for (const method of listenerMethods) {
      it(`exposes ${method}`, () => {
        const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
        expect(typeof api[method]).toBe('function');
      });
    }

    it('onSettingsUpdated registers listener via ipcRenderer.on', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      const callback = vi.fn();
      api.onSettingsUpdated(callback);
      expect(mockOn).toHaveBeenCalledWith('settings:updated', expect.any(Function));
    });

    it('listener returns an unsubscribe function', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      const callback = vi.fn();
      const unsubscribe = api.onSettingsUpdated(callback) as () => void;
      expect(typeof unsubscribe).toBe('function');
    });

    it('unsubscribe calls ipcRenderer.removeListener', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      const callback = vi.fn();
      const unsubscribe = api.onSettingsUpdated(callback) as () => void;
      unsubscribe();
      expect(mockRemoveListener).toHaveBeenCalledWith('settings:updated', expect.any(Function));
    });

    it('listener callback receives unwrapped data (strips IpcRendererEvent)', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
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
  });
});
