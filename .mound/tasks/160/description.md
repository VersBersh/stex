# STEX: Create a proper 256x256+ application icon for Windows installer

## Summary
The current `resources/tray-icon.ico` is only 32x32. electron-builder requires at least 256x256 for the Windows executable and NSIS installer icon. A multi-size ICO file (16, 32, 48, 256) should be created and configured in `electron-builder.json` under `win.icon`.

This is separate from the tray icon (task 37) — the tray icon can remain small, but the application/installer icon must meet electron-builder's minimum size requirement.

## Acceptance criteria
- A multi-size ICO file exists with at least 16x16, 32x32, 48x48, and 256x256 sizes
- `electron-builder.json` references the new icon under `win.icon`
- `electron-builder` can successfully build a Windows installer without icon-related errors
- The tray icon remains unchanged (still uses `resources/tray-icon.ico`)

## References
- Task 143: Make stex distributable on Windows via electron-builder installer
- `resources/tray-icon.ico` — current 32x32 icon
- `electron-builder.json` — build configuration
