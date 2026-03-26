# Plan

## Goal

Make webpack use `mode: 'production'` for dist builds while keeping `mode: 'development'` for local development, by reading `NODE_ENV` from the environment with an explicit production check.

## Steps

1. **Update `webpack.main.config.js`** — Change `mode: 'development'` to `mode: process.env.NODE_ENV === 'production' ? 'production' : 'development'`. This only activates production mode when `NODE_ENV` is explicitly set to `'production'`; any other value (including `'test'`, undefined, etc.) falls back to development mode.

2. **Update `webpack.preload.config.js`** — Same change: `mode: process.env.NODE_ENV === 'production' ? 'production' : 'development'`.

3. **Update `webpack.renderer.config.js`** — Same change: `mode: process.env.NODE_ENV === 'production' ? 'production' : 'development'`.

4. **Update `package.json` `dist` script** — Change from:
   ```
   "dist": "npm run build && electron-builder --win"
   ```
   to:
   ```
   "dist": "cross-env NODE_ENV=production npm run build && electron-builder --win"
   ```
   This sets `NODE_ENV=production` when running the build step within dist. `cross-env` is already a devDependency (used in the `debug` script).

5. **Verify** — Run `npm run build` to confirm development mode still works. Run `cross-env NODE_ENV=production npm run build` to confirm production mode works. Compare output bundle sizes to verify production bundles are smaller.

## Risks / Open Questions

- **Minimal risk**: The explicit production check (`=== 'production'`) ensures only the exact string `'production'` triggers production mode. All other values (including `'test'`, undefined) safely default to development.
- **Production mode effects**: Webpack production mode enables minification (TerserPlugin), tree-shaking, and sets `process.env.NODE_ENV` to `'production'` in bundled code via DefinePlugin. This is standard and expected.
- **Source maps**: Production mode defaults to no source maps (vs `eval` in development). This is acceptable for dist builds.
