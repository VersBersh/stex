# Context

## Relevant Files

- **`package.json`** — npm scripts (`build`, `start`), dependencies, devDependencies (includes `electron-builder` v25)
- **`electron-builder.json`** — existing electron-builder config: appId, NSIS target, output to `release/`, file globs
- **`webpack.main.config.js`** — webpack config for main process (externals: electron, electron-store, ws)
- **`webpack.preload.config.js`** — webpack config for preload scripts
- **`webpack.renderer.config.js`** — webpack config for renderer (overlay + settings windows)
- **`.gitignore`** — already includes `release/` and `dist/`
- **`README.md`** — project documentation (has outdated naudiodon references from before task 142)
- **`resources/tray-icon.ico`** — tray icon used at runtime; can also serve as the installer/app icon
- **`src/main/tray.ts`** — loads tray icon via `app.getAppPath() + 'resources/tray-icon.ico'`; works with asar
- **`src/main/window.ts`** — loads preload/renderer files via `__dirname`-relative paths under `dist/`

## Architecture

stex is an Electron desktop app. The build pipeline uses three webpack configs to produce:
- `dist/main/index.js` — main process bundle (externals: electron, electron-store, ws)
- `dist/preload/index.js` + `dist/preload/settings-preload.js` — preload scripts
- `dist/renderer/overlay/` + `dist/renderer/settings/` — renderer bundles + HTML

The `main` field in `package.json` points to `dist/main/index.js`. Runtime dependencies (`electron-store`, `ws`) are externalized by webpack and need to be available in `node_modules` at runtime — electron-builder handles this by including production `dependencies` in the packaged app.

The `resources/tray-icon.ico` is loaded via `app.getAppPath()` which resolves to the asar root in packaged apps, so the `files` glob `resources/**/*` in `electron-builder.json` correctly includes it inside the asar.
