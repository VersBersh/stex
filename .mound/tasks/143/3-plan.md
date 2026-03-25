# Plan

## Goal

Add an `npm run dist` script that produces a Windows NSIS installer via electron-builder, and update config/docs accordingly.

## Steps

### 1. Add `dist` script to `package.json`

Add a `"dist"` script that runs the webpack build then electron-builder:

```json
"dist": "npm run build && electron-builder --win"
```

This chains the existing `build` script (webpack) with electron-builder's Windows target.

### 2. Update `electron-builder.json`

Add `"icon": "resources/tray-icon.ico"` to the `win` section — this sets the application executable icon and the NSIS installer icon.

Updated config:
```json
{
  "appId": "com.draftable.stex",
  "productName": "stex",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**/*",
    "resources/**/*",
    "package.json"
  ],
  "win": {
    "target": "nsis",
    "icon": "resources/tray-icon.ico"
  }
}
```

The existing `files` array, `asar` default, and output directory are all correct — no other changes needed.

### 3. Update `README.md`

- Remove the outdated "Prerequisites" section about naudiodon/C++ build tools and native module rebuilding (naudiodon was removed in task 142)
- Simplify "Setup" to just `npm install`
- Add a "Building the installer" section explaining `npm run dist` and the `release/` output

### 4. Verify

- Run `npm run build` to ensure webpack still works
- Run `npm run dist` to produce the installer in `release/`
- Check that the installer file is created

## Risks / Open Questions

- **Icon quality**: The existing `resources/tray-icon.ico` is 32x32. NSIS ideally uses a 256x256 ICO for best results in Windows explorer and the installer UI. This is cosmetic and can be addressed in a follow-up.
- **Webpack mode**: All webpack configs use `mode: 'development'`. For a production installer, `mode: 'production'` would be better (smaller bundles, no dev warnings). However, changing webpack mode is out of scope — it would change runtime behavior and should be a separate task.
- **Stale spec/decisions.md**: Decision 5 in `spec/decisions.md` still references naudiodon (removed in task 142). This is pre-existing spec debt unrelated to the packaging task — flagged for a follow-up cleanup task.
