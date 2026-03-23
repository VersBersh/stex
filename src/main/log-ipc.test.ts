import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Hoisted mocks ---

const { mockIpcMainHandlers, mockLogFromRenderer } = vi.hoisted(() => {
  const mockIpcMainHandlers = new Map<string, (...args: unknown[]) => void>();
  const mockLogFromRenderer = vi.fn();
  return { mockIpcMainHandlers, mockLogFromRenderer };
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
}));

vi.mock('./logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./logger')>();
  return {
    ...actual,
    logFromRenderer: (...args: unknown[]) => mockLogFromRenderer(...args),
  };
});

import { registerLogIpc } from './log-ipc';
import { IpcChannels } from '../shared/ipc';

describe('log-ipc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIpcMainHandlers.clear();
  });

  it('registers a listener on the LOG_FROM_RENDERER channel', () => {
    registerLogIpc();
    expect(mockIpcMainHandlers.has(IpcChannels.LOG_FROM_RENDERER)).toBe(true);
  });

  it('forwards valid error-level messages to logFromRenderer', () => {
    registerLogIpc();
    const handler = mockIpcMainHandlers.get(IpcChannels.LOG_FROM_RENDERER)!;
    handler({}, 'error', 'something broke');
    expect(mockLogFromRenderer).toHaveBeenCalledWith('error', 'something broke');
  });

  it('forwards valid warn-level messages to logFromRenderer', () => {
    registerLogIpc();
    const handler = mockIpcMainHandlers.get(IpcChannels.LOG_FROM_RENDERER)!;
    handler({}, 'warn', 'heads up');
    expect(mockLogFromRenderer).toHaveBeenCalledWith('warn', 'heads up');
  });

  it('forwards valid info-level messages to logFromRenderer', () => {
    registerLogIpc();
    const handler = mockIpcMainHandlers.get(IpcChannels.LOG_FROM_RENDERER)!;
    handler({}, 'info', 'status update');
    expect(mockLogFromRenderer).toHaveBeenCalledWith('info', 'status update');
  });

  it('forwards valid debug-level messages to logFromRenderer', () => {
    registerLogIpc();
    const handler = mockIpcMainHandlers.get(IpcChannels.LOG_FROM_RENDERER)!;
    handler({}, 'debug', 'trace info');
    expect(mockLogFromRenderer).toHaveBeenCalledWith('debug', 'trace info');
  });

  it('ignores messages with invalid level string', () => {
    registerLogIpc();
    const handler = mockIpcMainHandlers.get(IpcChannels.LOG_FROM_RENDERER)!;
    handler({}, 'critical', 'nope');
    expect(mockLogFromRenderer).not.toHaveBeenCalled();
  });

  it('ignores messages with non-string level', () => {
    registerLogIpc();
    const handler = mockIpcMainHandlers.get(IpcChannels.LOG_FROM_RENDERER)!;
    handler({}, 42, 'nope');
    expect(mockLogFromRenderer).not.toHaveBeenCalled();
  });

  it('ignores messages with non-string message', () => {
    registerLogIpc();
    const handler = mockIpcMainHandlers.get(IpcChannels.LOG_FROM_RENDERER)!;
    handler({}, 'error', { obj: true });
    expect(mockLogFromRenderer).not.toHaveBeenCalled();
  });

  it('does not double-fire after re-registration', () => {
    registerLogIpc();
    registerLogIpc();

    const handler = mockIpcMainHandlers.get(IpcChannels.LOG_FROM_RENDERER)!;
    handler({}, 'error', 'test');

    expect(mockLogFromRenderer).toHaveBeenCalledTimes(1);
  });
});
