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

// --- Mock theme ---
vi.mock('./theme', () => ({
  resolveTheme: () => 'light',
}));

import {
  initWindowManager,
  showOverlay,
  hideOverlay,
  toggleOverlay,
  getOverlayWindow,
} from './window';

describe('Window Visibility', () => {
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

  describe('showOverlay', () => {
    it('shows the overlay window', () => {
      initWindowManager();
      showOverlay();
      const win = getOverlayWindow()!;
      expect(win.isVisible()).toBe(true);
    });

    it('restores saved position when valid', () => {
      mockSettingsData.windowPosition = { x: 200, y: 150 };
      initWindowManager();
      showOverlay();
      const win = getOverlayWindow()!;
      const bounds = win.getBounds();
      expect(bounds.x).toBe(200);
      expect(bounds.y).toBe(150);
    });
  });

  describe('hideOverlay', () => {
    it('hides the overlay window', () => {
      initWindowManager();
      showOverlay();
      hideOverlay();
      const win = getOverlayWindow()!;
      expect(win.isVisible()).toBe(false);
    });

    it('saves position on hide', () => {
      initWindowManager();
      showOverlay();
      hideOverlay();
      expect(mockSetSetting).toHaveBeenCalledWith('windowPosition', expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
    });

    it('saves size on hide', () => {
      initWindowManager();
      showOverlay();
      hideOverlay();
      expect(mockSetSetting).toHaveBeenCalledWith('windowSize', expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }));
    });

    it('is a no-op if window is not visible', () => {
      initWindowManager();
      // window starts hidden
      hideOverlay();
      expect(mockSetSetting).not.toHaveBeenCalled();
    });
  });

  describe('toggleOverlay', () => {
    it('shows overlay when hidden', () => {
      initWindowManager();
      toggleOverlay();
      const win = getOverlayWindow()!;
      expect(win.isVisible()).toBe(true);
    });

    it('hides overlay when visible', () => {
      initWindowManager();
      showOverlay();
      toggleOverlay();
      const win = getOverlayWindow()!;
      expect(win.isVisible()).toBe(false);
    });
  });
});
