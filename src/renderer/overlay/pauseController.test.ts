import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPauseController, type PauseApi } from './pauseController';

function createMockApi() {
  let statusCallback: ((status: string) => void) | undefined;
  const unsub = vi.fn();

  const api: PauseApi = {
    onSessionStatus: vi.fn((cb: (status: string) => void) => {
      statusCallback = cb;
      return unsub;
    }),
    sessionRequestPause: vi.fn(),
    sessionRequestResume: vi.fn(),
  };

  function sendStatus(status: string) {
    statusCallback?.(status);
  }

  return { api, unsub, sendStatus };
}

describe('createPauseController', () => {
  let api: ReturnType<typeof createMockApi>['api'];
  let unsub: ReturnType<typeof createMockApi>['unsub'];
  let sendStatus: ReturnType<typeof createMockApi>['sendStatus'];

  beforeEach(() => {
    ({ api, unsub, sendStatus } = createMockApi());
  });

  it('subscribes to onSessionStatus on creation', () => {
    createPauseController(api);

    expect(api.onSessionStatus).toHaveBeenCalledOnce();
  });

  it('isPaused() starts as false', () => {
    const controller = createPauseController(api);

    expect(controller.isPaused()).toBe(false);
  });

  it('sets paused to true when status is paused', () => {
    const controller = createPauseController(api);
    const listener = vi.fn();
    controller.subscribe(listener);

    sendStatus('paused');

    expect(controller.isPaused()).toBe(true);
    expect(listener).toHaveBeenCalledWith(true);
  });

  it('sets paused to false when status changes from paused to recording', () => {
    const controller = createPauseController(api);
    const listener = vi.fn();
    controller.subscribe(listener);

    sendStatus('paused');
    listener.mockClear();

    sendStatus('recording');

    expect(controller.isPaused()).toBe(false);
    expect(listener).toHaveBeenCalledWith(false);
  });

  it('resets paused to false on idle status', () => {
    const controller = createPauseController(api);
    const listener = vi.fn();
    controller.subscribe(listener);

    sendStatus('paused');
    listener.mockClear();

    sendStatus('idle');

    expect(controller.isPaused()).toBe(false);
    expect(listener).toHaveBeenCalledWith(false);
  });

  it('resets paused to false on error status', () => {
    const controller = createPauseController(api);
    const listener = vi.fn();
    controller.subscribe(listener);

    sendStatus('paused');
    listener.mockClear();

    sendStatus('error');

    expect(controller.isPaused()).toBe(false);
    expect(listener).toHaveBeenCalledWith(false);
  });

  it('toggle() calls sessionRequestPause when not paused', () => {
    const controller = createPauseController(api);

    controller.toggle();

    expect(api.sessionRequestPause).toHaveBeenCalledOnce();
    expect(api.sessionRequestResume).not.toHaveBeenCalled();
  });

  it('toggle() calls sessionRequestResume when paused', () => {
    const controller = createPauseController(api);
    sendStatus('paused');

    controller.toggle();

    expect(api.sessionRequestResume).toHaveBeenCalledOnce();
    expect(api.sessionRequestPause).not.toHaveBeenCalled();
  });

  it('destroy() unsubscribes from onSessionStatus', () => {
    const controller = createPauseController(api);

    controller.destroy();

    expect(unsub).toHaveBeenCalledOnce();
  });

  it('does not notify listeners on duplicate state transitions', () => {
    const controller = createPauseController(api);
    const listener = vi.fn();
    controller.subscribe(listener);

    sendStatus('paused');
    sendStatus('paused');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('subscribe returns an unsubscribe function', () => {
    const controller = createPauseController(api);
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);

    unsubscribe();
    sendStatus('paused');

    expect(listener).not.toHaveBeenCalled();
  });
});
