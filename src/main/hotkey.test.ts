import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Mock setup via vi.hoisted ---
const {
  mockGlobalShortcut,
  mockNotificationInstances,
  mockAppEventHandlers,
  mockSettingsData,
  mockToggleOverlay,
  mockSettingsListeners,
} = vi.hoisted(() => {
  const mockGlobalShortcut = {
    register: vi.fn((_accel: string, _cb: () => void) => true),
    unregister: vi.fn(),
    unregisterAll: vi.fn(),
  };
  const mockNotificationInstances: Array<{ title: string; body: string; show: ReturnType<typeof vi.fn> }> = [];
  const mockAppEventHandlers = new Map<string, Array<(...args: unknown[]) => void>>();
  const mockSettingsData: Record<string, unknown> = {};
  const mockToggleOverlay = vi.fn();
  const mockSettingsListeners: Array<(settings: Record<string, unknown>) => void> = [];
  return {
    mockGlobalShortcut,
    mockNotificationInstances,
    mockAppEventHandlers,
    mockSettingsData,
    mockToggleOverlay,
    mockSettingsListeners,
  };
});

// --- Mock electron ---
vi.mock('electron', () => ({
  globalShortcut: mockGlobalShortcut,
  Notification: class MockNotification {
    title: string;
    body: string;
    show = vi.fn();
    constructor(opts: { title: string; body: string }) {
      this.title = opts.title;
      this.body = opts.body;
      this.show = vi.fn();
      mockNotificationInstances.push(this);
    }
  },
  app: {
    on: (event: string, handler: (...args: unknown[]) => void) => {
      if (!mockAppEventHandlers.has(event)) {
        mockAppEventHandlers.set(event, []);
      }
      mockAppEventHandlers.get(event)!.push(handler);
    },
    removeListener: (event: string, handler: (...args: unknown[]) => void) => {
      const handlers = mockAppEventHandlers.get(event);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx >= 0) handlers.splice(idx, 1);
      }
    },
  },
}));

// --- Mock settings ---
vi.mock('./settings', () => ({
  getSettings: () => ({
    hotkey: (mockSettingsData.hotkey as string) ?? 'Ctrl+Shift+Space',
    launchOnStartup: false,
    onHide: 'clipboard',
    onShow: 'fresh',
    audioInputDevice: null,
    sonioxApiKey: '',
    sonioxModel: 'stt-rt-preview',
    language: 'en',
    maxEndpointDelayMs: 1000,
    theme: 'system',
    windowPosition: null,
    windowSize: { width: 600, height: 300 },
  }),
  onSettingsChanged: (listener: (settings: Record<string, unknown>) => void) => {
    mockSettingsListeners.push(listener);
    return () => {
      const idx = mockSettingsListeners.indexOf(listener);
      if (idx >= 0) mockSettingsListeners.splice(idx, 1);
    };
  },
}));

// --- Mock window ---
vi.mock('./window', () => ({
  toggleOverlay: (...args: unknown[]) => mockToggleOverlay(...args),
}));

import { initHotkeyManager } from './hotkey';

describe('Hotkey Manager', () => {
  beforeEach(() => {
    mockGlobalShortcut.register.mockClear();
    mockGlobalShortcut.register.mockReturnValue(true);
    mockGlobalShortcut.unregister.mockClear();
    mockGlobalShortcut.unregisterAll.mockClear();
    mockNotificationInstances.length = 0;
    mockAppEventHandlers.clear();
    mockToggleOverlay.mockClear();
    mockSettingsListeners.length = 0;
    Object.keys(mockSettingsData).forEach((k) => delete mockSettingsData[k]);
  });

  describe('initHotkeyManager', () => {
    it('registers the hotkey from settings', () => {
      initHotkeyManager();
      expect(mockGlobalShortcut.register).toHaveBeenCalledWith(
        'Ctrl+Shift+Space',
        expect.any(Function),
      );
    });

    it('registers custom hotkey from settings', () => {
      mockSettingsData.hotkey = 'Alt+S';
      initHotkeyManager();
      expect(mockGlobalShortcut.register).toHaveBeenCalledWith(
        'Alt+S',
        expect.any(Function),
      );
    });

    it('subscribes to settings changes', () => {
      initHotkeyManager();
      expect(mockSettingsListeners).toHaveLength(1);
    });

    it('registers will-quit handler', () => {
      initHotkeyManager();
      expect(mockAppEventHandlers.has('will-quit')).toBe(true);
    });
  });

  describe('hotkey callback', () => {
    it('calls toggleOverlay when hotkey is pressed', () => {
      initHotkeyManager();
      const callback = mockGlobalShortcut.register.mock.calls[0][1] as () => void;
      callback();
      expect(mockToggleOverlay).toHaveBeenCalledTimes(1);
    });
  });

  describe('registration failure', () => {
    it('shows a notification when registration fails', () => {
      mockGlobalShortcut.register.mockReturnValue(false);
      initHotkeyManager();
      expect(mockNotificationInstances).toHaveLength(1);
      expect(mockNotificationInstances[0].title).toBe('Hotkey Registration Failed');
      expect(mockNotificationInstances[0].body).toContain('Ctrl+Shift+Space');
      expect(mockNotificationInstances[0].body).toContain('already in use');
      expect(mockNotificationInstances[0].show).toHaveBeenCalled();
    });

    it('shows a notification when accelerator is invalid (throws)', () => {
      mockGlobalShortcut.register.mockImplementation(() => {
        throw new Error('Invalid accelerator');
      });
      initHotkeyManager();
      expect(mockNotificationInstances).toHaveLength(1);
      expect(mockNotificationInstances[0].title).toBe('Hotkey Registration Failed');
      expect(mockNotificationInstances[0].body).toContain('not valid');
      expect(mockNotificationInstances[0].show).toHaveBeenCalled();
    });

    it('preserves old hotkey when new registration fails', () => {
      initHotkeyManager();
      expect(mockGlobalShortcut.register).toHaveBeenCalledTimes(1);

      // Fail the next registration
      mockGlobalShortcut.register.mockReturnValue(false);
      const listener = mockSettingsListeners[0];
      listener({ hotkey: 'Alt+Bad' });

      // Old hotkey should NOT have been unregistered
      expect(mockGlobalShortcut.unregister).not.toHaveBeenCalled();
    });

    it('does not spam re-registration on unrelated settings changes after failure', () => {
      mockGlobalShortcut.register.mockReturnValue(false);
      initHotkeyManager();
      expect(mockGlobalShortcut.register).toHaveBeenCalledTimes(1);

      // Simulate an unrelated settings change (e.g., window move)
      const listener = mockSettingsListeners[0];
      listener({ hotkey: 'Ctrl+Shift+Space' });

      // Should not re-attempt — hotkey hasn't changed from what was requested
      expect(mockGlobalShortcut.register).toHaveBeenCalledTimes(1);
    });
  });

  describe('settings change', () => {
    it('re-registers when hotkey setting changes', () => {
      initHotkeyManager();
      expect(mockGlobalShortcut.register).toHaveBeenCalledTimes(1);

      const listener = mockSettingsListeners[0];
      listener({ hotkey: 'Alt+X' });

      // New hotkey registered, then old one unregistered
      expect(mockGlobalShortcut.register).toHaveBeenCalledTimes(2);
      expect(mockGlobalShortcut.register).toHaveBeenLastCalledWith('Alt+X', expect.any(Function));
      expect(mockGlobalShortcut.unregister).toHaveBeenCalledWith('Ctrl+Shift+Space');
    });

    it('does not re-register when hotkey is unchanged', () => {
      initHotkeyManager();
      expect(mockGlobalShortcut.register).toHaveBeenCalledTimes(1);

      const listener = mockSettingsListeners[0];
      listener({ hotkey: 'Ctrl+Shift+Space' });

      expect(mockGlobalShortcut.register).toHaveBeenCalledTimes(1);
    });

    it('new hotkey callback calls toggleOverlay', () => {
      initHotkeyManager();
      const listener = mockSettingsListeners[0];
      listener({ hotkey: 'Alt+X' });

      const callback = mockGlobalShortcut.register.mock.calls[1][1] as () => void;
      callback();
      expect(mockToggleOverlay).toHaveBeenCalledTimes(1);
    });
  });

  describe('will-quit cleanup', () => {
    it('unregisters all shortcuts on will-quit', () => {
      initHotkeyManager();
      const handlers = mockAppEventHandlers.get('will-quit') ?? [];
      for (const handler of handlers) handler();

      expect(mockGlobalShortcut.unregisterAll).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes settings listener on will-quit', () => {
      initHotkeyManager();
      expect(mockSettingsListeners).toHaveLength(1);

      const handlers = mockAppEventHandlers.get('will-quit') ?? [];
      for (const handler of handlers) handler();

      expect(mockSettingsListeners).toHaveLength(0);
    });
  });

  describe('idempotency', () => {
    it('cleans up previous state when called twice', () => {
      initHotkeyManager();
      expect(mockSettingsListeners).toHaveLength(1);
      expect(mockGlobalShortcut.register).toHaveBeenCalledTimes(1);

      initHotkeyManager();
      // Should still be exactly 1 settings listener (old one removed, new one added)
      expect(mockSettingsListeners).toHaveLength(1);
      // Previous hotkey should have been unregistered during cleanup
      expect(mockGlobalShortcut.unregister).toHaveBeenCalledWith('Ctrl+Shift+Space');
    });

    it('does not leak will-quit handlers on repeated init', () => {
      initHotkeyManager();
      initHotkeyManager();
      initHotkeyManager();

      const handlers = mockAppEventHandlers.get('will-quit') ?? [];
      // Only one will-quit handler should be registered
      expect(handlers).toHaveLength(1);
    });
  });
});
