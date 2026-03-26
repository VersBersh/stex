Trivial: yes

## Files created or modified
- `resources/icon.ico` (new) — Multi-size ICO file with 16x16, 32x32, 48x48, and 256x256 PNG images. Design matches existing tray icon (dark rounded square, white "S").
- `electron-builder.json` (modified) — Added `"icon": "resources/icon.ico"` to `win` section.

## Deviations from plan
- The generation script (`scripts/generate-icon.js`) was created, used, and deleted in one step rather than being committed. This is as planned.
- Used sharp (installed temporarily via `npm install --no-save`) to render SVG to PNG at each size, then assembled the ICO manually.

## New tasks or follow-up work
None.
