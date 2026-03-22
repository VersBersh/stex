import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Hoisted mocks ---

const { mockOverlayWindow } = vi.hoisted(() => {
  const mockWebContents = { send: vi.fn() };
  const mockOverlayWindow = {
    webContents: mockWebContents,
    isDestroyed: vi.fn(() => false),
  };

  return { mockOverlayWindow };
});

let returnWindow: typeof mockOverlayWindow | null = mockOverlayWindow;

vi.mock('./window', () => ({
  getOverlayWindow: () => returnWindow,
}));

import { sendToRenderer, sendStatus, sendError, clearError } from './renderer-send';
import { IpcChannels } from '../shared/ipc';

describe('renderer-send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    returnWindow = mockOverlayWindow;
    mockOverlayWindow.isDestroyed.mockReturnValue(false);
  });

  describe('sendToRenderer', () => {
    it('sends channel and args to overlay window webContents', () => {
      sendToRenderer('test:channel', 'arg1', 42);

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith('test:channel', 'arg1', 42);
    });

    it('does nothing when overlay window is null', () => {
      returnWindow = null;

      sendToRenderer('test:channel', 'arg1');

      expect(mockOverlayWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('does nothing when overlay window is destroyed', () => {
      mockOverlayWindow.isDestroyed.mockReturnValue(true);

      sendToRenderer('test:channel', 'arg1');

      expect(mockOverlayWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('sends channel with no additional args', () => {
      sendToRenderer('test:channel');

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith('test:channel');
    });
  });

  describe('sendStatus', () => {
    it('sends session status to renderer', () => {
      sendStatus('recording');

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(IpcChannels.SESSION_STATUS, 'recording');
    });

    it('sends different status values', () => {
      sendStatus('idle');

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(IpcChannels.SESSION_STATUS, 'idle');
    });
  });

  describe('sendError', () => {
    it('sends error info to renderer', () => {
      const error = { type: 'network' as const, message: 'Connection lost' };
      sendError(error);

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(IpcChannels.SESSION_ERROR, error);
    });

    it('sends null to clear error', () => {
      sendError(null);

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(IpcChannels.SESSION_ERROR, null);
    });
  });

  describe('clearError', () => {
    it('sends null error to renderer', () => {
      clearError();

      expect(mockOverlayWindow.webContents.send).toHaveBeenCalledWith(IpcChannels.SESSION_ERROR, null);
    });
  });
});
