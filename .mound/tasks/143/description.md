# Make stex distributable on Windows

## Summary

stex has `electron-builder` installed and a basic `electron-builder.json` config (NSIS target, appId, file globs), but there is no npm script or CI step to actually produce a distributable installer. The goal is to make it possible to build a Windows installer that other users can run without needing Node.js or a dev environment.

## Current state

- `electron-builder` v25 is a devDependency
- `electron-builder.json` exists with appId `com.draftable.stex`, NSIS target, output to `release/`
- `npm run build` runs webpack for main/preload/renderer but does not invoke electron-builder
- No `dist`, `pack`, or `make` npm script exists
- No code signing or auto-update configuration
- The `naudiodon` native addon was recently removed (task 142), so there should be no native modules to rebuild

## Acceptance criteria

- An npm script (e.g. `npm run dist`) that runs the webpack build and then `electron-builder --win` to produce an NSIS installer
- The resulting installer works on a clean Windows machine (no Node.js required)
- `electron-builder.json` is reviewed and updated if needed (e.g. icon, file associations, asar packaging)
- The `release/` output directory is in `.gitignore`
- A brief note in the README or a top-level doc on how to build the installer

## Out of scope

- Code signing (can be a follow-up task)
- Auto-update / Squirrel integration
- macOS or Linux builds
- CI/CD pipeline (can be a follow-up task)

## References

- `electron-builder.json` — existing config
- `package.json` — scripts and dependencies
- `webpack.main.config.js`, `webpack.preload.config.js`, `webpack.renderer.config.js` — build pipeline
