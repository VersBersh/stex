# Plan

## Goal

Build the overlay window's React UI shell with a Lexical editor, custom frameless title bar, and status bar with action buttons, plus the preload bridge needed for renderer IPC.

## Steps

### 1. Create preload script (`src/main/preload.ts`)

Create a preload script that uses `contextBridge.exposeInMainWorld` to expose a minimal IPC bridge to the renderer. Exposes:
- `window.electronAPI.hideWindow()` — sends `window:hide` to main
- `window.electronAPI.requestPause()` — sends `session:request-pause` to main
- `window.electronAPI.requestResume()` — sends `session:request-resume` to main

```ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  hideWindow: () => ipcRenderer.send('window:hide'),
  requestPause: () => ipcRenderer.send('session:request-pause'),
  requestResume: () => ipcRenderer.send('session:request-resume'),
});
```

### 2. Add type declarations for renderer (`src/renderer/types.d.ts`)

Two declarations in one file:

```ts
// CSS module imports
declare module '*.css';

// Preload API exposed via contextBridge
interface ElectronAPI {
  hideWindow(): void;
  requestPause(): void;
  requestResume(): void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
```

### 3. Wire preload into overlay BrowserWindow (`src/main/window.ts`)

Minimal edit to `createOverlayWindowInternal()`:
- Add `preload: path.join(__dirname, 'preload.js')` to `webPreferences`

### 4. Register `window:hide` IPC handler (`src/main/window.ts`)

In `initWindowManager()`, add:
```ts
ipcMain.on('window:hide', () => { hideOverlay(); });
```
Import `ipcMain` from electron.

### 5. Add preload to webpack main config (`webpack.main.config.js`)

Change entry from a string to an object with two entries, and update output.filename to use `[name].js`:
```js
entry: {
  index: './src/main/index.ts',
  preload: './src/main/preload.ts',
},
output: {
  path: path.resolve(__dirname, 'dist/main'),
  filename: '[name].js',
},
```

This outputs `dist/main/preload.js` alongside `dist/main/index.js`. The `package.json` `main` field is `dist/main/index.js` which still resolves correctly with `[name].js` producing `index.js`.

### 6. Add IPC channel constant (`src/shared/ipc.ts`)

Add `WINDOW_HIDE: 'window:hide'` to `IpcChannels`.

### 7. Create overlay CSS (`src/renderer/overlay/overlay.css`)

Global styles for the overlay window:
- `html, body, #root`: full height, no margin, overflow hidden, font-family system-ui
- `.overlay-app`: flex column, full height
- `.title-bar`: `-webkit-app-region: drag`, background color, height 32px, flex row
- `.title-bar-btn`: `-webkit-app-region: no-drag`
- `.editor-container`: flex-grow, overflow-y auto
- `.editor-input`: min-height 100%, padding, outline none
- `.status-bar`: height 36px, flex row, padding, border-top, justify-content space-between

### 8. Create TitleBar component (`src/renderer/overlay/components/TitleBar.tsx`)

Simple component with drag region and hide button. Calls `window.electronAPI.hideWindow()` on click.

### 9. Create OverlayContext for shared state (`src/renderer/overlay/OverlayContext.tsx`)

A React context that holds:
- `clearEditor(): void` — clears the Lexical editor
- `copyText(): void` — copies editor text to clipboard
- `requestClear(): void` — entry point for clear with inline confirmation (used by both button and keyboard shortcut)
- `confirmingClear: boolean` — whether the "Confirm?" state is active
- `paused: boolean` — local pause/resume toggle state
- `togglePauseResume(): void` — toggles paused state and sends appropriate IPC

The context provider manages:
- Clear confirmation timer (3-second timeout)
- Pause/resume toggle state
- Lexical editor instance ref (set by Editor, used by clear/copy)

Both StatusBar and keyboard shortcuts consume this context to ensure consistent behavior.

### 10. Create Editor component (`src/renderer/overlay/editor/Editor.tsx`)

Lexical editor wrapper using `@lexical/react`:
- `LexicalComposer` with `RichTextPlugin`, `ContentEditable`, `HistoryPlugin`, `LexicalErrorBoundary`
- An `EditorBridge` plugin that captures the `LexicalEditor` instance and registers it with `OverlayContext`
- Standard keyboard shortcuts (Ctrl+A, C, V, Z, Shift+Z, Backspace) handled natively by Lexical's RichTextPlugin

### 11. Create StatusBar component (`src/renderer/overlay/components/StatusBar.tsx`)

Consumes `OverlayContext` to:
- Display mic icon + "Idle" status text
- Show Pause/Resume button (label toggles based on `paused` state)
- Show Clear/Confirm? button (label toggles based on `confirmingClear` state)
- Show Copy button

All actions delegate to context methods (`togglePauseResume`, `requestClear`, `copyText`).

### 12. Add window-level keyboard shortcut handler

Register keyboard shortcuts at the **window level** (not inside Lexical) so they work regardless of focus:

In the App component or OverlayContext provider, add a `useEffect` that attaches a `keydown` listener to `document`:
- `Escape` → `window.electronAPI.hideWindow()`
- `Ctrl+Shift+Backspace` → `requestClear()` from context
- `Ctrl+P` → `togglePauseResume()` from context

This ensures shortcuts work even when focus is on the title bar or status bar buttons, matching the spec requirement that these are "in-app hotkeys" that work whenever the stex window is focused.

### 13. Update overlay entry (`src/renderer/overlay/index.tsx`)

Replace the scaffold with the full layout:

```tsx
import { createRoot } from 'react-dom/client';
import { TitleBar } from './components/TitleBar';
import { Editor } from './editor/Editor';
import { StatusBar } from './components/StatusBar';
import { OverlayProvider } from './OverlayContext';
import './overlay.css';

function App() {
  return (
    <OverlayProvider>
      <div className="overlay-app">
        <TitleBar />
        <Editor />
        <StatusBar />
      </div>
    </OverlayProvider>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
```

### 14. Update `spec/architecture.md`

Add `window:hide` IPC channel to the IPC Messages table and `preload.ts` to the file structure, as described in `2-spec-updates.md`.

## Risks / Open Questions

1. **Preload bundling**: The preload script must be bundled separately by webpack since it runs in a special Electron context. Adding it as a second entry to `webpack.main.config.js` should work because the main config targets `electron-main`, which has access to `contextBridge` and `ipcRenderer`. The preload script uses a small subset of Electron APIs available in the preload context.

2. **Cross-task file modification**: This task modifies `src/main/window.ts` (owned by T4), `src/shared/ipc.ts` (owned by T2), and `webpack.main.config.js` (owned by T4). These are minimal additions (preload path, IPC handler, one constant, entry config) necessary for the UI to function per the acceptance criteria. If this causes merge conflicts, they should be trivial.

3. **Lexical version compatibility**: The `@lexical/react` package version `^0.22.0` should include `LexicalComposer`, `RichTextPlugin`, `ContentEditable`, `HistoryPlugin`, and `LexicalErrorBoundary`. The API has been stable across recent versions.

4. **Emoji mic icon**: Using a Unicode mic character as a placeholder. A proper SVG icon could be added later.

5. **Existing window.test.ts**: The test file mocks `electron` without `ipcMain`. Adding `ipcMain.on` to `initWindowManager()` may break existing tests if the mock doesn't provide `ipcMain`. This will need a small mock addition in the test file, or we can handle the import defensively. We'll check during implementation and add the minimal mock if needed.

6. **Pause/resume state**: The local `paused` toggle is a UI-only state for this shell task. In the future, it will be driven by main-process session state via IPC. The toggle correctly sends both `requestPause` and `requestResume` IPC messages.
