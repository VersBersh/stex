import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Mock setup via vi.hoisted ---
const { mockWindowConstructorCalls, mockDisplays, mockSettingsData, mockSetSetting, mockAppEventHandlers, mockIpcMainHandlers } = vi.hoisted(() => {
  const mockWindowConstructorCalls: Array<Record<string, unknown>> = [];
  const mockDisplays: Array<{ bounds: { x: number; y: number; width: number; height: number }; workArea: { x: number; y: number; width: number; height: number } }> = [];
  const mockSettingsData: Record<string, unknown> = {};
  const mockSetSetting = vi.fn();
  const mockAppEventHandlers = new Map<string, Array<(...args: unknown[]) => void>>();
  const mockIpcMainHandlers = new Map<string, Array<(...args: unknown[]) => void>>();
  return { mockWindowConstructorCalls, mockDisplays, mockSettingsData, mockSetSetting, mockAppEventHandlers, mockIpcMainHandlers };
});

// --- Mock electron ---
vi.mock('electron', () => {
  class MockBrowserWindow {
    private _opts: Record<string, unknown>;
    private _shown: boolean;
    private _focused: boolean;
    private _destroyed: boolean;
    private _opacity: number;
    private _bounds: { x: number; y: number; width: number; height: number };
    private _eventHandlers: Map<string, Array<(...args: unknown[]) => void>>;
    private _loadedFile: string | null;
    webContents: { send: (...args: unknown[]) => void };

    constructor(opts: Record<string, unknown>) {
      this._opts = { ...opts };
      mockWindowConstructorCalls.push(this._opts);
      this._shown = (opts.show as boolean) !== false;
      this._focused = false;
      this._destroyed = false;
      this._opacity = 1.0;
      this._bounds = {
        x: (opts.x as number) ?? 100,
        y: (opts.y as number) ?? 100,
        width: (opts.width as number) ?? 600,
        height: (opts.height as number) ?? 300,
      };
      this._eventHandlers = new Map();
      this._loadedFile = null;
      this.webContents = { send: vi.fn() };
    }

    get constructorOptions() { return this._opts; }
    get loadedFile() { return this._loadedFile; }

    show() { this._shown = true; }
    hide() { this._shown = false; }
    focus() { this._focused = true; }
    destroy() { this._destroyed = true; this._shown = false; }
    isVisible() { return this._shown && !this._destroyed; }
    isDestroyed() { return this._destroyed; }
    isFocused() { return this._focused; }
    setOpacity(o: number) { this._opacity = o; }
    getOpacity() { return this._opacity; }
    setPosition(x: number, y: number) { this._bounds.x = x; this._bounds.y = y; }
    setSize(w: number, h: number) { this._bounds.width = w; this._bounds.height = h; }
    center() { this._bounds.x = 660; this._bounds.y = 390; }
    setBounds(b: { x: number; y: number; width: number; height: number }) {
      if (b.x !== undefined) this._bounds.x = b.x;
      if (b.y !== undefined) this._bounds.y = b.y;
      if (b.width !== undefined) this._bounds.width = b.width;
      if (b.height !== undefined) this._bounds.height = b.height;
    }
    getBounds() { return { ...this._bounds }; }
    getPosition(): [number, number] { return [this._bounds.x, this._bounds.y]; }
    getSize(): [number, number] { return [this._bounds.width, this._bounds.height]; }
    loadFile(p: string) { this._loadedFile = p; }
    on(event: string, handler: (...args: unknown[]) => void) {
      if (!this._eventHandlers.has(event)) {
        this._eventHandlers.set(event, []);
      }
      this._eventHandlers.get(event)!.push(handler);
      return this;
    }
    emit(event: string, ...args: unknown[]) {
      const handlers = this._eventHandlers.get(event) ?? [];
      for (const handler of handlers) {
        handler(...args);
      }
    }
  }

  return {
    BrowserWindow: MockBrowserWindow,
    screen: {
      getAllDisplays: () => mockDisplays,
      getPrimaryDisplay: () => mockDisplays[0] ?? {
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      },
    },
    app: {
      on: (event: string, handler: (...args: unknown[]) => void) => {
        if (!mockAppEventHandlers.has(event)) {
          mockAppEventHandlers.set(event, []);
        }
        mockAppEventHandlers.get(event)!.push(handler);
      },
    },
    ipcMain: {
      on: (channel: string, handler: (...args: unknown[]) => void) => {
        if (!mockIpcMainHandlers.has(channel)) {
          mockIpcMainHandlers.set(channel, []);
        }
        mockIpcMainHandlers.get(channel)!.push(handler);
      },
      removeAllListeners: (channel: string) => {
        mockIpcMainHandlers.delete(channel);
      },
    },
  };
});

// --- Mock settings ---
vi.mock('./settings', () => ({
  getSettings: () => ({
    hotkey: 'Ctrl+Shift+Space',
    launchOnStartup: false,
    onHide: 'clipboard',
    onShow: 'fresh',
    audioInputDevice: null,
    sonioxApiKey: '',
    sonioxModel: 'stt-rt-preview',
    language: 'en',
    maxEndpointDelayMs: 1000,
    theme: 'system',
    windowPosition: mockSettingsData.windowPosition ?? null,
    windowSize: mockSettingsData.windowSize ?? { width: 600, height: 300 },
  }),
  setSetting: (...args: unknown[]) => mockSetSetting(...args),
}));

import {
  initWindowManager,
  getOverlayWindow,
} from './window';

describe('Window Construction', () => {
  beforeEach(() => {
    mockWindowConstructorCalls.length = 0;
    mockDisplays.length = 0;
    mockDisplays.push({
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    });
    mockSetSetting.mockClear();
    mockAppEventHandlers.clear();
    mockIpcMainHandlers.clear();
    Object.keys(mockSettingsData).forEach((k) => delete mockSettingsData[k]);
  });

  describe('initWindowManager', () => {
    it('creates the overlay window hidden', () => {
      initWindowManager();
      expect(mockWindowConstructorCalls).toHaveLength(1);
      expect(mockWindowConstructorCalls[0].show).toBe(false);
    });

    it('creates overlay as frameless', () => {
      initWindowManager();
      expect(mockWindowConstructorCalls[0].frame).toBe(false);
    });

    it('creates overlay as always-on-top', () => {
      initWindowManager();
      expect(mockWindowConstructorCalls[0].alwaysOnTop).toBe(true);
    });

    it('creates overlay with skip-taskbar', () => {
      initWindowManager();
      expect(mockWindowConstructorCalls[0].skipTaskbar).toBe(true);
    });

    it('creates overlay with correct default size', () => {
      initWindowManager();
      expect(mockWindowConstructorCalls[0].width).toBe(600);
      expect(mockWindowConstructorCalls[0].height).toBe(300);
    });

    it('creates overlay with minimum size constraints', () => {
      initWindowManager();
      expect(mockWindowConstructorCalls[0].minWidth).toBe(400);
      expect(mockWindowConstructorCalls[0].minHeight).toBe(200);
    });

    it('creates overlay with saved size from settings', () => {
      mockSettingsData.windowSize = { width: 800, height: 400 };
      initWindowManager();
      expect(mockWindowConstructorCalls[0].width).toBe(800);
      expect(mockWindowConstructorCalls[0].height).toBe(400);
    });

    it('creates overlay with preload script path', () => {
      initWindowManager();
      const webPrefs = mockWindowConstructorCalls[0].webPreferences as Record<string, unknown>;
      expect(webPrefs.preload).toContain('preload');
      expect(webPrefs.preload).toMatch(/index\.js$/);
    });

    it('loads overlay renderer HTML', () => {
      initWindowManager();
      const win = getOverlayWindow()!;
      expect((win as unknown as { loadedFile: string }).loadedFile).toContain('overlay');
    });

    it('registers before-quit handler on app', () => {
      initWindowManager();
      expect(mockAppEventHandlers.has('before-quit')).toBe(true);
    });
  });

  describe('getOverlayWindow', () => {
    it('returns the window after init', () => {
      initWindowManager();
      expect(getOverlayWindow()).not.toBeNull();
    });
  });
});
