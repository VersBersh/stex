# Context

## Relevant Files

| File | Role |
|------|------|
| `src/renderer/overlay/index.html` | Overlay HTML template (scaffold only — `<div id="root">`) |
| `src/renderer/overlay/index.tsx` | Overlay React entry point (scaffold only — renders "stex overlay") |
| `src/shared/types.ts` | Shared types: `SessionState`, `AppSettings`, `EditorBlock`, `GhostText`, `SonioxToken` |
| `src/shared/ipc.ts` | IPC channel name constants (`IpcChannels`) |
| `src/main/window.ts` | Window Manager — creates overlay `BrowserWindow` (frameless, always-on-top, skip-taskbar). No preload script configured yet. |
| `src/main/index.ts` | Main process entry — calls `initWindowManager()` and `registerSettingsIpc()` |
| `webpack.renderer.config.js` | Webpack config for renderer — builds overlay and settings bundles with ts-loader and css-loader |
| `tsconfig.renderer.json` | TypeScript config for renderer — enables JSX (`react-jsx`), ES2020 modules |
| `package.json` | Dependencies include `lexical`, `@lexical/react`, `react`, `react-dom`. CSS handled by `style-loader`/`css-loader`. |
| `spec/ui.md` | UI spec — layout wireframe, window behavior, status bar actions, text styling |
| `spec/hotkeys.md` | Hotkey spec — in-app hotkeys (Escape, Ctrl+A/C/V/Z, Ctrl+Shift+Z, Ctrl+Backspace, Ctrl+Shift+Backspace, Ctrl+P) |
| `spec/architecture.md` | Architecture spec — component responsibilities, IPC messages, file structure |

## Architecture

The Electron app has a main process managing windows, settings, and (future) audio/transcription. The renderer process for the overlay is a React app bundled by webpack.

**Current state**: The overlay renderer is a bare scaffold (`<div>stex overlay</div>`). No components exist yet. The `BrowserWindow` is configured with `contextIsolation: true` and `nodeIntegration: false`, but no preload script — meaning the renderer currently cannot send IPC messages to the main process.

**What this task builds**: The three visual regions of the overlay:
1. **TitleBar** — custom drag region + hide button
2. **Editor** — Lexical rich-text editor taking up the main area
3. **StatusBar** — mic state indicator + Pause/Clear/Copy action buttons

**Key constraints**:
- No preload script exists yet. For IPC actions (hide window, pause/resume) to work, a preload bridge is needed. This is a known gap from T4 (discovered-tasks).
- Lexical is already a dependency (`^0.22.0` with `@lexical/react`).
- CSS is loaded via `style-loader`/`css-loader` (imported `.css` files).
- The overlay is frameless (`frame: false`) — the title bar must provide drag functionality via `-webkit-app-region: drag`.
- The task is "visual shell only" — no transcription integration. Status is hardcoded to "Idle".
