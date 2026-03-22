import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Hoisted mocks ---

const { mockIpcMainHandlers, mockClipboard } = vi.hoisted(() => {
  const mockIpcMainHandlers = new Map<string, (...args: unknown[]) => void>();
  const mockClipboard = { writeText: vi.fn() };

  return { mockIpcMainHandlers, mockClipboard };
});

vi.mock('electron', () => ({
  ipcMain: {
    once: (channel: string, handler: (...args: unknown[]) => void) => {
      mockIpcMainHandlers.set(channel, handler);
    },
    removeListener: (channel: string, _handler: (...args: unknown[]) => void) => {
      mockIpcMainHandlers.delete(channel);
    },
  },
  clipboard: mockClipboard,
}));

import { copyEditorTextToClipboard } from './session-clipboard';
import { IpcChannels } from '../shared/ipc';

describe('session-clipboard', () => {
  let mockSendToRenderer: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIpcMainHandlers.clear();
    mockSendToRenderer = vi.fn();
  });

  it('sends SESSION_TEXT to renderer to request text', () => {
    copyEditorTextToClipboard(mockSendToRenderer);

    expect(mockSendToRenderer).toHaveBeenCalledWith(IpcChannels.SESSION_TEXT);
  });

  it('registers a one-time listener for SESSION_TEXT', () => {
    copyEditorTextToClipboard(mockSendToRenderer);

    expect(mockIpcMainHandlers.has(IpcChannels.SESSION_TEXT)).toBe(true);
  });

  it('writes text to clipboard when renderer responds with text', async () => {
    const promise = copyEditorTextToClipboard(mockSendToRenderer);

    const handler = mockIpcMainHandlers.get(IpcChannels.SESSION_TEXT)!;
    handler({}, 'hello world');

    const result = await promise;

    expect(mockClipboard.writeText).toHaveBeenCalledWith('hello world');
    expect(result).toBe(true);
  });

  it('resolves false when renderer responds with empty text', async () => {
    const promise = copyEditorTextToClipboard(mockSendToRenderer);

    const handler = mockIpcMainHandlers.get(IpcChannels.SESSION_TEXT)!;
    handler({}, '');

    const result = await promise;

    expect(mockClipboard.writeText).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('resolves false on timeout', async () => {
    vi.useFakeTimers();

    const promise = copyEditorTextToClipboard(mockSendToRenderer);

    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;

    expect(mockClipboard.writeText).not.toHaveBeenCalled();
    expect(result).toBe(false);

    vi.useRealTimers();
  });

  it('removes IPC listener on timeout', async () => {
    vi.useFakeTimers();

    copyEditorTextToClipboard(mockSendToRenderer);

    await vi.advanceTimersByTimeAsync(2000);

    // The listener should have been removed after timeout
    // (our mock removes the key on removeListener)
    expect(mockIpcMainHandlers.has(IpcChannels.SESSION_TEXT)).toBe(false);

    vi.useRealTimers();
  });
});
