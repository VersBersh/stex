# Context

## Relevant Files
- `resources/tray-icon.ico` — Current 32x32 ICO with 3 sizes (16, 24, 32). Used for system tray only.
- `electron-builder.json` — Build config for electron-builder. Currently has no `win.icon` setting.
- `src/main/tray.ts` — Loads `tray-icon.ico` for the system tray via `nativeImage.createFromPath`.
- `package.json` — Has `dist` script: `npm run build && electron-builder --win`.

## Architecture
The app uses electron-builder for Windows distribution (NSIS installer). The tray icon (`tray-icon.ico`) is a dark rounded square with a white "S" logo, containing 16x16, 24x24, and 32x32 PNG images. electron-builder requires a separate application icon of at least 256x256 for the Windows executable and installer. The `win.icon` field in `electron-builder.json` points to this icon. The tray icon and app icon are separate files with separate concerns — the tray icon stays small for system tray display, the app icon must be large for Windows shell integration.
