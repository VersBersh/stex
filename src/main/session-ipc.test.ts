import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Hoisted mocks ---

const { mockIpcMainHandlers, mockShowSettings, mockShell } = vi.hoisted(() => {
  const mockIpcMainHandlers = new Map<string, (...args: unknown[]) => void>();
  const mockShowSettings = vi.fn();
  const mockShell = { openExternal: vi.fn() };

  return { mockIpcMainHandlers, mockShowSettings, mockShell };
});

vi.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, handler: (...args: unknown[]) => void) => {
      mockIpcMainHandlers.set(channel, handler);
    },
    removeListener: (channel: string, _handler: (...args: unknown[]) => void) => {
      mockIpcMainHandlers.delete(channel);
    },
  },
  shell: mockShell,
}));

vi.mock('./window', () => ({
  showSettings: (...args: unknown[]) => mockShowSettings(...args),
}));

import { registerSessionIpc } from './session-ipc';
import { IpcChannels } from '../shared/ipc';

function createMockActions() {
  return {
    onPause: vi.fn(),
    onResume: vi.fn(),
    onDismissError: vi.fn(),
    onEscapeHide: vi.fn(),
  };
}

describe('session-ipc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIpcMainHandlers.clear();
  });

  it('registers all 6 IPC channels', () => {
    registerSessionIpc(createMockActions());

    expect(mockIpcMainHandlers.has(IpcChannels.SESSION_REQUEST_PAUSE)).toBe(true);
    expect(mockIpcMainHandlers.has(IpcChannels.SESSION_REQUEST_RESUME)).toBe(true);
    expect(mockIpcMainHandlers.has(IpcChannels.SESSION_DISMISS_ERROR)).toBe(true);
    expect(mockIpcMainHandlers.has(IpcChannels.SESSION_OPEN_SETTINGS)).toBe(true);
    expect(mockIpcMainHandlers.has(IpcChannels.SESSION_OPEN_MIC_SETTINGS)).toBe(true);
    expect(mockIpcMainHandlers.has(IpcChannels.WINDOW_ESCAPE_HIDE)).toBe(true);
  });

  it('delegates pause IPC to onPause callback', () => {
    const actions = createMockActions();
    registerSessionIpc(actions);

    mockIpcMainHandlers.get(IpcChannels.SESSION_REQUEST_PAUSE)?.();

    expect(actions.onPause).toHaveBeenCalledTimes(1);
  });

  it('delegates resume IPC to onResume callback', () => {
    const actions = createMockActions();
    registerSessionIpc(actions);

    mockIpcMainHandlers.get(IpcChannels.SESSION_REQUEST_RESUME)?.();

    expect(actions.onResume).toHaveBeenCalledTimes(1);
  });

  it('delegates dismiss-error IPC to onDismissError callback', () => {
    const actions = createMockActions();
    registerSessionIpc(actions);

    mockIpcMainHandlers.get(IpcChannels.SESSION_DISMISS_ERROR)?.();

    expect(actions.onDismissError).toHaveBeenCalledTimes(1);
  });

  it('opens settings on open-settings IPC', () => {
    registerSessionIpc(createMockActions());

    mockIpcMainHandlers.get(IpcChannels.SESSION_OPEN_SETTINGS)?.();

    expect(mockShowSettings).toHaveBeenCalledTimes(1);
  });

  it('opens Windows mic settings on open-mic-settings IPC', () => {
    registerSessionIpc(createMockActions());

    mockIpcMainHandlers.get(IpcChannels.SESSION_OPEN_MIC_SETTINGS)?.();

    expect(mockShell.openExternal).toHaveBeenCalledWith('ms-settings:privacy-microphone');
  });

  it('delegates escape-hide IPC to onEscapeHide callback', () => {
    const actions = createMockActions();
    registerSessionIpc(actions);

    mockIpcMainHandlers.get(IpcChannels.WINDOW_ESCAPE_HIDE)?.();

    expect(actions.onEscapeHide).toHaveBeenCalledTimes(1);
  });

  it('does not double-fire after re-registration', () => {
    const firstActions = createMockActions();
    registerSessionIpc(firstActions);

    const secondActions = createMockActions();
    registerSessionIpc(secondActions);

    mockIpcMainHandlers.get(IpcChannels.SESSION_REQUEST_PAUSE)?.();

    expect(firstActions.onPause).not.toHaveBeenCalled();
    expect(secondActions.onPause).toHaveBeenCalledTimes(1);
  });
});
