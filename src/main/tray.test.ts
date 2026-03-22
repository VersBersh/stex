import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Mock setup via vi.hoisted ---
const { mockTrayInstances, mockMenuTemplates, mockToggleOverlay, mockShowSettings, mockAppQuit, mockCreateFromPath, mockIconEmpty, mockSetImage, MOCK_NORMAL_IMAGE, MOCK_FLASH_IMAGE } = vi.hoisted(() => {
  const mockTrayInstances: Array<{
    icon: unknown;
    tooltip: string | null;
    contextMenu: unknown;
    destroyed: boolean;
    images: unknown[];
  }> = [];
  const mockMenuTemplates: Array<Array<Record<string, unknown>>> = [];
  const mockToggleOverlay = vi.fn();
  const mockShowSettings = vi.fn();
  const mockAppQuit = vi.fn();
  const mockCreateFromPath = vi.fn();
  const mockIconEmpty = { value: false };
  const mockSetImage = vi.fn();
  const MOCK_NORMAL_IMAGE = { _type: 'normal', isEmpty: () => mockIconEmpty.value };
  const MOCK_FLASH_IMAGE = { _type: 'flash', isEmpty: () => false };
  return { mockTrayInstances, mockMenuTemplates, mockToggleOverlay, mockShowSettings, mockAppQuit, mockCreateFromPath, mockIconEmpty, mockSetImage, MOCK_NORMAL_IMAGE, MOCK_FLASH_IMAGE };
});

// --- Mock electron ---
vi.mock('electron', () => {
  const MOCK_NATIVE_IMAGE = { _isMockNativeImage: true, isEmpty: () => mockIconEmpty.value };

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
        images: [],
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

    setImage(image: unknown) {
      this._instance.images.push(image);
      mockSetImage(image);
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
      createFromPath: (...args: unknown[]) => {
        mockCreateFromPath(...args);
        return MOCK_NORMAL_IMAGE;
      },
      createFromDataURL: () => {
        return MOCK_FLASH_IMAGE;
      },
    },
    app: {
      quit: (...args: unknown[]) => mockAppQuit(...args),
      getAppPath: () => '/mock-app',
    },
  };
});

// --- Mock window module ---
vi.mock('./window', () => ({
  showSettings: (...args: unknown[]) => mockShowSettings(...args),
}));

// --- Mock session module ---
vi.mock('./session', () => ({
  requestToggle: (...args: unknown[]) => mockToggleOverlay(...args),
}));

import { initTray, destroyTray, flashTrayIcon } from './tray';

describe('Tray Manager', () => {
  beforeEach(() => {
    mockTrayInstances.length = 0;
    mockMenuTemplates.length = 0;
    mockToggleOverlay.mockClear();
    mockShowSettings.mockClear();
    mockAppQuit.mockClear();
    mockCreateFromPath.mockClear();
    mockSetImage.mockClear();
    mockIconEmpty.value = false;
    destroyTray();
  });

  describe('initTray', () => {
    it('creates a Tray instance', () => {
      initTray();
      expect(mockTrayInstances).toHaveLength(1);
    });

    it('creates tray with a NativeImage icon loaded from the correct path', () => {
      initTray();
      expect(mockTrayInstances[0].icon).toEqual({ _type: 'normal', isEmpty: expect.any(Function) });
      expect(mockCreateFromPath).toHaveBeenCalledWith(
        expect.stringMatching(/mock-app[/\\]resources[/\\]tray-icon\.ico$/),
      );
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

    it('throws if icon file is missing (isEmpty)', () => {
      mockIconEmpty.value = true;
      expect(() => initTray()).toThrow('Tray icon not found');
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

  describe('flashTrayIcon', () => {
    it('changes icon to flash and reverts after 600ms', () => {
      vi.useFakeTimers();
      initTray();
      mockSetImage.mockClear();

      flashTrayIcon();

      // Flash icon set immediately
      expect(mockSetImage).toHaveBeenCalledTimes(1);
      expect(mockSetImage).toHaveBeenCalledWith(MOCK_FLASH_IMAGE);

      // Advance past flash duration
      vi.advanceTimersByTime(600);

      // Normal icon restored
      expect(mockSetImage).toHaveBeenCalledTimes(2);
      expect(mockSetImage).toHaveBeenLastCalledWith(MOCK_NORMAL_IMAGE);

      vi.useRealTimers();
    });

    it('is safe when tray not initialized', () => {
      // Should not throw
      expect(() => flashTrayIcon()).not.toThrow();
    });

    it('cancels previous flash when called again', () => {
      vi.useFakeTimers();
      initTray();
      mockSetImage.mockClear();

      flashTrayIcon();
      expect(mockSetImage).toHaveBeenCalledTimes(1);

      // Call again before timer fires
      vi.advanceTimersByTime(300);
      mockSetImage.mockClear();
      flashTrayIcon();

      expect(mockSetImage).toHaveBeenCalledTimes(1); // new flash
      expect(mockSetImage).toHaveBeenCalledWith(MOCK_FLASH_IMAGE);

      // Only one revert should happen (from the second flash)
      vi.advanceTimersByTime(600);
      expect(mockSetImage).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });
});
