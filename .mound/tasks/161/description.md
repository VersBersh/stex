# STEX: Add production webpack mode for dist builds

## Summary
All three webpack configs (`webpack.main.config.js`, `webpack.preload.config.js`, `webpack.renderer.config.js`) hardcode `mode: 'development'`. The dist build should use `mode: 'production'` for smaller bundles, tree-shaking, and no dev warnings. This was discovered during task 143 when installer bundles were unnecessarily large (~80MB), partly due to development-mode webpack output.

## Acceptance criteria
- When building for distribution (e.g., `npm run dist` or `electron-builder`), all three webpack configs use `mode: 'production'`
- Development mode (`npm start` / `npm run dev`) continues to use `mode: 'development'`
- Implementation approach is flexible: could use `NODE_ENV`, a separate webpack config, or a webpack config function — whichever fits the existing build setup best
- Dist bundle size is measurably smaller than the current development-mode build

## References
- Task 143: Make stex distributable on Windows via electron-builder installer
- `webpack.main.config.js`, `webpack.preload.config.js`, `webpack.renderer.config.js`
- `electron-builder.json` — build configuration
