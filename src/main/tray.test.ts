import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Mock setup via vi.hoisted ---
const { mockTrayInstances, mockMenuTemplates, mockToggleOverlay, mockShowSettings, mockAppQuit } = vi.hoisted(() => {
  const mockTrayInstances: Array<{
    icon: unknown;
    tooltip: string | null;
    contextMenu: unknown;
    destroyed: boolean;
  }> = [];
  const mockMenuTemplates: Array<Array<Record<string, unknown>>> = [];
  const mockToggleOverlay = vi.fn();
  const mockShowSettings = vi.fn();
  const mockAppQuit = vi.fn();
  return { mockTrayInstances, mockMenuTemplates, mockToggleOverlay, mockShowSettings, mockAppQuit };
});

// --- Mock electron ---
vi.mock('electron', () => {
  const MOCK_NATIVE_IMAGE = { _isMockNativeImage: true };

  class MockTray {
    private _icon: unknown;
    private _tooltip: string | null = null;
    private _contextMenu: unknown = null;
    private _destroyed = false;
    private _instance: (typeof mockTrayInstances)[number];

    constructor(icon: unknown) {
      this._icon = icon;
      this._instance = {
        icon,
        tooltip: null,
        contextMenu: null,
        destroyed: false,
      };
      mockTrayInstances.push(this._instance);
    }

    setToolTip(tip: string) {
      this._tooltip = tip;
      this._instance.tooltip = tip;
    }

    setContextMenu(menu: unknown) {
      this._contextMenu = menu;
      this._instance.contextMenu = menu;
    }

    isDestroyed() { return this._destroyed; }

    destroy() {
      this._destroyed = true;
      this._instance.destroyed = true;
    }
  }

  return {
    Tray: MockTray,
    Menu: {
      buildFromTemplate: (template: Array<Record<string, unknown>>) => {
        mockMenuTemplates.push(template);
        return { _template: template };
      },
    },
    nativeImage: {
      createFromBuffer: () => MOCK_NATIVE_IMAGE,
    },
    app: {
      quit: (...args: unknown[]) => mockAppQuit(...args),
    },
  };
});

// --- Mock window module ---
vi.mock('./window', () => ({
  toggleOverlay: (...args: unknown[]) => mockToggleOverlay(...args),
  showSettings: (...args: unknown[]) => mockShowSettings(...args),
}));

import { initTray, destroyTray } from './tray';

describe('Tray Manager', () => {
  beforeEach(() => {
    mockTrayInstances.length = 0;
    mockMenuTemplates.length = 0;
    mockToggleOverlay.mockClear();
    mockShowSettings.mockClear();
    mockAppQuit.mockClear();
    destroyTray();
  });

  describe('initTray', () => {
    it('creates a Tray instance', () => {
      initTray();
      expect(mockTrayInstances).toHaveLength(1);
    });

    it('creates tray with a NativeImage icon', () => {
      initTray();
      expect(mockTrayInstances[0].icon).toEqual({ _isMockNativeImage: true });
    });

    it('sets tooltip to Stex', () => {
      initTray();
      expect(mockTrayInstances[0].tooltip).toBe('Stex');
    });

    it('sets a context menu', () => {
      initTray();
      expect(mockTrayInstances[0].contextMenu).not.toBeNull();
    });

    it('context menu has 4 items (Show/Hide, Settings, separator, Quit)', () => {
      initTray();
      expect(mockMenuTemplates).toHaveLength(1);
      const template = mockMenuTemplates[0];
      expect(template).toHaveLength(4);
      expect(template[0].label).toBe('Show/Hide');
      expect(template[1].label).toBe('Settings');
      expect(template[2].type).toBe('separator');
      expect(template[3].label).toBe('Quit');
    });

    it('Show/Hide click calls toggleOverlay', () => {
      initTray();
      const showHideItem = mockMenuTemplates[0][0];
      (showHideItem.click as () => void)();
      expect(mockToggleOverlay).toHaveBeenCalledOnce();
    });

    it('Settings click calls showSettings', () => {
      initTray();
      const settingsItem = mockMenuTemplates[0][1];
      (settingsItem.click as () => void)();
      expect(mockShowSettings).toHaveBeenCalledOnce();
    });

    it('Quit click calls app.quit', () => {
      initTray();
      const quitItem = mockMenuTemplates[0][3];
      (quitItem.click as () => void)();
      expect(mockAppQuit).toHaveBeenCalledOnce();
    });

    it('destroys previous tray when called twice', () => {
      initTray();
      initTray();
      expect(mockTrayInstances).toHaveLength(2);
      expect(mockTrayInstances[0].destroyed).toBe(true);
      expect(mockTrayInstances[1].destroyed).toBe(false);
    });
  });

  describe('destroyTray', () => {
    it('destroys the tray instance', () => {
      initTray();
      destroyTray();
      expect(mockTrayInstances[0].destroyed).toBe(true);
    });

    it('is a no-op when no tray exists', () => {
      // Should not throw
      destroyTray();
    });

    it('is a no-op when called twice', () => {
      initTray();
      destroyTray();
      destroyTray();
      expect(mockTrayInstances[0].destroyed).toBe(true);
    });
  });
});
