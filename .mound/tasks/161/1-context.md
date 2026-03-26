# Context

## Relevant Files

- `webpack.main.config.js` — Webpack config for the Electron main process. Hardcodes `mode: 'development'`.
- `webpack.preload.config.js` — Webpack config for preload scripts. Hardcodes `mode: 'development'`.
- `webpack.renderer.config.js` — Webpack config for renderer (React UI). Hardcodes `mode: 'development'`.
- `package.json` — NPM scripts including `build` (runs all 3 webpack builds) and `dist` (build + electron-builder).
- `electron-builder.json` — Electron-builder config, packages contents of `dist/` into an installer.

## Architecture

STEX is an Electron app with three webpack build targets (main, preload, renderer). The `build` script runs all three webpack configs sequentially. The `dist` script runs `build` then `electron-builder --win` to produce a Windows installer.

Currently all three configs hardcode `mode: 'development'`, meaning dist builds include unminified code, development warnings, and no tree-shaking. The project already has `cross-env` as a devDependency for setting environment variables cross-platform (used in the `debug` script).
