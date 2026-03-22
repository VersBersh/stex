import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSessionLifecycleController, type SessionLifecycleApi } from './sessionLifecycleController';

function createMockApi() {
  let startCallback: ((onShow: 'fresh' | 'append') => void) | undefined;
  const unsub = vi.fn();

  const api: SessionLifecycleApi = {
    onSessionStart: vi.fn((cb: (onShow: 'fresh' | 'append') => void) => {
      startCallback = cb;
      return unsub;
    }),
  };

  function triggerSessionStart(onShow: 'fresh' | 'append') {
    startCallback?.(onShow);
  }

  return { api, unsub, triggerSessionStart };
}

describe('createSessionLifecycleController', () => {
  let clearEditor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearEditor = vi.fn();
  });

  it('subscribes to onSessionStart on creation', () => {
    const { api } = createMockApi();

    createSessionLifecycleController(api, clearEditor);

    expect(api.onSessionStart).toHaveBeenCalledOnce();
  });

  it('calls clearEditor on session:start when onShow is "fresh"', () => {
    const { api, triggerSessionStart } = createMockApi();

    createSessionLifecycleController(api, clearEditor);
    triggerSessionStart('fresh');

    expect(clearEditor).toHaveBeenCalledOnce();
  });

  it('does NOT call clearEditor on session:start when onShow is "append"', () => {
    const { api, triggerSessionStart } = createMockApi();

    createSessionLifecycleController(api, clearEditor);
    triggerSessionStart('append');

    expect(clearEditor).not.toHaveBeenCalled();
  });

  it('destroy() unsubscribes from onSessionStart', () => {
    const { api, unsub } = createMockApi();

    const controller = createSessionLifecycleController(api, clearEditor);
    controller.destroy();

    expect(unsub).toHaveBeenCalledOnce();
  });

  it('handles multiple session starts independently', () => {
    const { api, triggerSessionStart } = createMockApi();

    createSessionLifecycleController(api, clearEditor);

    triggerSessionStart('fresh');
    expect(clearEditor).toHaveBeenCalledOnce();

    triggerSessionStart('append');
    // clearEditor should still have been called only once (from the first start)
    expect(clearEditor).toHaveBeenCalledOnce();

    triggerSessionStart('fresh');
    expect(clearEditor).toHaveBeenCalledTimes(2);
  });
});
