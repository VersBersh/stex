# Context

## Relevant Files

- `tsconfig.renderer.json` — Target file; TypeScript config for the renderer (Electron) process. Currently lacks test file exclusions.
- `tsconfig.main.json` — Reference file; TypeScript config for the main (Electron) process. Already has `"exclude": ["**/*.test.ts", "**/*.spec.ts"]` added by task 27.
- `tsconfig.json` — Base TypeScript config extended by both `tsconfig.main.json` and `tsconfig.renderer.json`.

## Architecture

The project uses separate TypeScript configurations for the Electron main process (`tsconfig.main.json`) and renderer process (`tsconfig.renderer.json`), both extending a shared base `tsconfig.json`. Each config scopes its `include` to the relevant source directories (`src/main/**/*` or `src/renderer/**/*`) plus `src/shared/**/*`. Task 27 added test file exclusions to the main config to prevent `.test.ts` and `.spec.ts` files from being compiled into the webpack bundle. The same exclusion is needed in the renderer config for consistency.
