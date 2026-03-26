# Plan

## Goal
Create a multi-size application ICO file (16, 32, 48, 256) and configure `electron-builder.json` to use it as `win.icon`.

## Steps

1. **Generate the multi-size ICO file** (`resources/icon.ico`)
   - Write a Node.js build script (`scripts/generate-icon.js`) that:
     a. Defines the stex logo as SVG (dark rounded rect with white "S" — matching the existing tray icon design)
     b. Uses `sharp` to render the SVG at 256x256, 48x48, 32x32, and 16x16
     c. Packages the PNGs into a single ICO file (ICO format: 6-byte header + 16-byte directory entries + PNG payloads)
   - Run the script to produce `resources/icon.ico`
   - Remove the script after generation (it's a one-time tool)

2. **Update `electron-builder.json`**
   - Add `"icon": "resources/icon.ico"` to the `"win"` section

3. **Clean up temporary files**
   - Remove extracted PNG files from step 1 investigation

## Risks / Open Questions
- The SVG-rendered icon may not be pixel-perfect match of the original at small sizes, but the 16x16 and 32x32 from the original ICO can be used directly for those sizes to maintain consistency.
- `sharp` is available via npx but not installed as a project dependency. The generation script is a one-time build tool, not a runtime dependency.

## Trivial assessment
Trivial: yes — touches 2 source files (new `resources/icon.ico`, edit `electron-builder.json`), no APIs/types/logic changes, fully specified.
