# Context

## Relevant Files

| File | Role |
|------|------|
| `src/main/tray.ts` | Tray Manager — creates system tray icon, context menu, exports `initTray`/`destroyTray` |
| `src/main/tray.test.ts` | Unit tests for Tray Manager — mocks Electron's `Tray`, `Menu`, `nativeImage` |
| `src/main/index.ts` | Main process entry — calls `initTray()` on app ready |
| `webpack.main.config.js` | Webpack config for main process — compiles TS, outputs to `dist/main/` |
| `electron-builder.json` | Electron-builder packaging config — references `dist/**/*` as files to include |
| `spec/features/system-tray.md` | System tray feature spec — describes tray icon behavior |
| `spec/architecture.md` | Architecture spec — file structure, component responsibilities |
| `spec/ui.md` | UI spec — no tray icon design guidance, focuses on overlay window |

## Architecture

The **Tray Manager** (`src/main/tray.ts`) is a thin module that:
1. Creates a `NativeImage` from an embedded base64 PNG (currently a 16x16 grey square placeholder)
2. Instantiates an Electron `Tray` with that image
3. Sets a tooltip ("Stex") and a context menu (Show/Hide, Settings, separator, Quit)
4. Exports `initTray()` (called once at startup from `index.ts`) and `destroyTray()`

Key constraints:
- The main process webpack config (`webpack.main.config.js`) only handles `.ts` files — no asset loaders configured (no file-loader, asset/resource, etc.)
- The build output goes to `dist/main/` and `electron-builder.json` packages `dist/**/*`
- `__dirname` is set to `false` in webpack config, so `__dirname` at runtime resolves to the actual output directory (`dist/main/`)
- The current icon is created via `nativeImage.createFromBuffer()` from a base64 string — no file I/O involved
- The test file mocks `nativeImage.createFromBuffer` to return a sentinel object; tests don't care about actual image content
- Electron's `Tray` on Windows supports `.ico` natively via `nativeImage.createFromPath()` for best multi-resolution rendering
- No existing image assets exist in the project (no `.ico`, `.png`, `.svg` files anywhere)
