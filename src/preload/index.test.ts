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

    it('getResolvedTheme calls ipcRenderer.invoke with theme:get', async () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      mockInvoke.mockResolvedValue('dark');
      const result = await api.getResolvedTheme();
      expect(mockInvoke).toHaveBeenCalledWith('theme:get');
      expect(result).toBe('dark');
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

    it('hideWindow calls ipcRenderer.send with window:hide', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      api.hideWindow();
      expect(mockSend).toHaveBeenCalledWith('window:hide');
    });

    it('openSettings calls ipcRenderer.send with session:open-settings', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      api.openSettings();
      expect(mockSend).toHaveBeenCalledWith('session:open-settings');
    });

    it('openMicSettings calls ipcRenderer.send with session:open-mic-settings', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      api.openMicSettings();
      expect(mockSend).toHaveBeenCalledWith('session:open-mic-settings');
    });

    it('dismissError calls ipcRenderer.send with session:dismiss-error', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      api.dismissError();
      expect(mockSend).toHaveBeenCalledWith('session:dismiss-error');
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
      'onThemeChanged',
      'onSessionError',
      'onAudioLevel',
      'onAudioStartCapture',
      'onAudioStopCapture',
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

    it('onSessionStart forwards onShow parameter to callback', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      const callback = vi.fn();
      api.onSessionStart(callback);
      const wrapper = mockOn.mock.calls.find(
        (call: unknown[]) => call[0] === 'session:start',
      )![1] as (...args: unknown[]) => void;
      wrapper({}, 'fresh');
      expect(callback).toHaveBeenCalledWith('fresh');
    });

    it('onSessionStart forwards append value', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      const callback = vi.fn();
      api.onSessionStart(callback);
      const wrapper = mockOn.mock.calls.find(
        (call: unknown[]) => call[0] === 'session:start',
      )![1] as (...args: unknown[]) => void;
      wrapper({}, 'append');
      expect(callback).toHaveBeenCalledWith('append');
    });

    it('onThemeChanged registers listener via ipcRenderer.on', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      const callback = vi.fn();
      api.onThemeChanged(callback);
      expect(mockOn).toHaveBeenCalledWith('theme:resolved', expect.any(Function));
    });

    it('onThemeChanged unsubscribe calls ipcRenderer.removeListener', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      const callback = vi.fn();
      const unsubscribe = api.onThemeChanged(callback) as () => void;
      unsubscribe();
      expect(mockRemoveListener).toHaveBeenCalledWith('theme:resolved', expect.any(Function));
    });

    it('onSessionError registers listener via ipcRenderer.on', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      const callback = vi.fn();
      api.onSessionError(callback);
      expect(mockOn).toHaveBeenCalledWith('session:error', expect.any(Function));
    });

    it('onSessionError unsubscribe calls ipcRenderer.removeListener', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      const callback = vi.fn();
      const unsubscribe = api.onSessionError(callback) as () => void;
      unsubscribe();
      expect(mockRemoveListener).toHaveBeenCalledWith('session:error', expect.any(Function));
    });

    it('onSessionError callback receives null for error cleared', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      const callback = vi.fn();
      api.onSessionError(callback);
      const wrapper = mockOn.mock.calls.find(
        (call: unknown[]) => call[0] === 'session:error',
      )![1] as (...args: unknown[]) => void;
      wrapper({}, null);
      expect(callback).toHaveBeenCalledWith(null);
    });
  });

  describe('log method', () => {
    it('exposes log', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      expect(typeof api.log).toBe('function');
    });

    it('log calls ipcRenderer.send with log:from-renderer channel', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      api.log('error', 'something broke');
      expect(mockSend).toHaveBeenCalledWith('log:from-renderer', 'error', 'something broke');
    });
  });

  describe('audio capture send methods', () => {
    it('exposes sendAudioChunk', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      expect(typeof api.sendAudioChunk).toBe('function');
    });

    it('sendAudioChunk calls ipcRenderer.send with audio:chunk', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      const buffer = new ArrayBuffer(3200);
      api.sendAudioChunk(buffer);
      expect(mockSend).toHaveBeenCalledWith('audio:chunk', expect.any(Buffer));
    });

    it('exposes sendAudioCaptureError', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      expect(typeof api.sendAudioCaptureError).toBe('function');
    });

    it('sendAudioCaptureError calls ipcRenderer.send with audio:capture-error', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      api.sendAudioCaptureError('Microphone access denied');
      expect(mockSend).toHaveBeenCalledWith('audio:capture-error', 'Microphone access denied');
    });
  });

  describe('onRequestSessionText', () => {
    it('exposes onRequestSessionText', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      expect(typeof api.onRequestSessionText).toBe('function');
    });

    it('registers listener for session:text channel', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      const callback = vi.fn();
      api.onRequestSessionText(callback);
      expect(mockOn).toHaveBeenCalledWith('session:text', expect.any(Function));
    });

    it('unsubscribe removes listener', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      const callback = vi.fn();
      const unsubscribe = api.onRequestSessionText(callback) as () => void;
      unsubscribe();
      expect(mockRemoveListener).toHaveBeenCalledWith('session:text', expect.any(Function));
    });

    it('invokes callback when session:text is received', () => {
      const api = exposed.api as Record<string, (...args: unknown[]) => unknown>;
      const callback = vi.fn();
      api.onRequestSessionText(callback);
      const wrapper = mockOn.mock.calls.find(
        (call: unknown[]) => call[0] === 'session:text',
      )![1] as (...args: unknown[]) => void;
      wrapper({});
      expect(callback).toHaveBeenCalled();
    });
  });
});
