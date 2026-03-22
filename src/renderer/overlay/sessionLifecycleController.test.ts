import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSessionLifecycleController, type SessionLifecycleApi } from './sessionLifecycleController';
import type { AppSettings } from '../../shared/types';

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    hotkey: 'Ctrl+Shift+Space',
    launchOnStartup: false,
    onHide: 'none',
    onShow: 'fresh',
    audioInputDevice: null,
    sonioxApiKey: '',
    sonioxModel: 'stt',
    language: 'en',
    maxEndpointDelayMs: 1000,
    theme: 'system',
    windowPosition: null,
    windowSize: { width: 400, height: 300 },
    ...overrides,
  };
}

function createMockApi(settings: AppSettings) {
  let startCallback: (() => void) | undefined;
  const unsub = vi.fn();

  const api: SessionLifecycleApi = {
    onSessionStart: vi.fn((cb: () => void) => {
      startCallback = cb;
      return unsub;
    }),
    settingsGet: vi.fn(() => Promise.resolve(settings)),
  };

  function triggerSessionStart() {
    startCallback?.();
  }

  return { api, unsub, triggerSessionStart };
}

describe('createSessionLifecycleController', () => {
  let clearEditor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearEditor = vi.fn();
  });

  it('subscribes to onSessionStart on creation', () => {
    const { api } = createMockApi(makeSettings());

    createSessionLifecycleController(api, clearEditor);

    expect(api.onSessionStart).toHaveBeenCalledOnce();
  });

  it('calls clearEditor on session:start when onShow is "fresh"', async () => {
    const { api, triggerSessionStart } = createMockApi(makeSettings({ onShow: 'fresh' }));

    createSessionLifecycleController(api, clearEditor);
    triggerSessionStart();

    // settingsGet is async, so we need to flush the promise
    await vi.waitFor(() => {
      expect(clearEditor).toHaveBeenCalledOnce();
    });
  });

  it('does NOT call clearEditor on session:start when onShow is "append"', async () => {
    const { api, triggerSessionStart } = createMockApi(makeSettings({ onShow: 'append' }));

    createSessionLifecycleController(api, clearEditor);
    triggerSessionStart();

    // Flush the promise
    await Promise.resolve();

    expect(clearEditor).not.toHaveBeenCalled();
  });

  it('destroy() unsubscribes from onSessionStart', () => {
    const { api, unsub } = createMockApi(makeSettings());

    const controller = createSessionLifecycleController(api, clearEditor);
    controller.destroy();

    expect(unsub).toHaveBeenCalledOnce();
  });

  it('does NOT call clearEditor if destroyed before settingsGet resolves', async () => {
    let resolveSettings!: (value: AppSettings) => void;
    const { api, triggerSessionStart } = createMockApi(makeSettings({ onShow: 'fresh' }));
    vi.mocked(api.settingsGet).mockReturnValueOnce(
      new Promise((resolve) => { resolveSettings = resolve; }),
    );

    const controller = createSessionLifecycleController(api, clearEditor);
    triggerSessionStart();
    controller.destroy();

    // Resolve the settings after destroy
    resolveSettings(makeSettings({ onShow: 'fresh' }));
    await Promise.resolve();

    expect(clearEditor).not.toHaveBeenCalled();
  });

  it('does not throw when settingsGet rejects', async () => {
    const { api, triggerSessionStart } = createMockApi(makeSettings());
    vi.mocked(api.settingsGet).mockRejectedValueOnce(new Error('IPC failed'));

    createSessionLifecycleController(api, clearEditor);
    triggerSessionStart();

    // Flush the rejected promise — should not throw
    await Promise.resolve();
    await Promise.resolve();

    expect(clearEditor).not.toHaveBeenCalled();
  });

  it('fetches settings on each session start independently', async () => {
    const settings = makeSettings({ onShow: 'fresh' });
    const { api, triggerSessionStart } = createMockApi(settings);

    createSessionLifecycleController(api, clearEditor);

    triggerSessionStart();
    await vi.waitFor(() => {
      expect(clearEditor).toHaveBeenCalledOnce();
    });

    // Change settings to append for second call
    vi.mocked(api.settingsGet).mockResolvedValueOnce(makeSettings({ onShow: 'append' }));
    triggerSessionStart();
    await Promise.resolve();

    // clearEditor should still have been called only once (from the first start)
    expect(clearEditor).toHaveBeenCalledOnce();
  });
});
