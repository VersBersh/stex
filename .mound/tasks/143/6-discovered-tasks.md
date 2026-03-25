# Discovered Tasks

## 1. STEX: Create a proper 256x256+ application icon
The current `resources/tray-icon.ico` is only 32x32. electron-builder requires at least 256x256 for the Windows executable and NSIS installer icon. A multi-size ICO (16, 32, 48, 256) should be created and configured in `electron-builder.json` under `win.icon`.

**Why discovered**: electron-builder failed with "image must be at least 256x256" when the plan attempted to set `win.icon` to the existing tray icon.

## 2. STEX: Add production webpack mode for dist builds
All three webpack configs (`webpack.main.config.js`, `webpack.preload.config.js`, `webpack.renderer.config.js`) hardcode `mode: 'development'`. The dist build should use `mode: 'production'` for smaller bundles and no dev warnings. Could be done via `NODE_ENV` or a separate webpack config.

**Why discovered**: Noticed during implementation that the installer bundles are unnecessarily large (80MB) partly due to development mode webpack output.

## 3. SPEC: Update spec/decisions.md Decision 5 (naudiodon removal)
Decision 5 in `spec/decisions.md` still says audio capture uses native `naudiodon` in the main process. This was removed in task 142 and replaced with renderer-side `getUserMedia` + `AudioWorklet`. The decision should be updated to reflect the current architecture.

**Why discovered**: Codex plan review flagged the inconsistency between `spec/decisions.md` and the current code/architecture spec.
