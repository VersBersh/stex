# Context

## Relevant Files

- `tsconfig.main.json` — TypeScript config for the Electron main process; extends `tsconfig.json`, includes `src/main/**/*` and `src/shared/**/*`. **This is the file to modify.**
- `tsconfig.json` — Base TypeScript config with shared compiler options.
- `tsconfig.renderer.json` — TypeScript config for the renderer process (same pattern, no test files there currently).
- `webpack.main.config.js` — Webpack config for the main process; uses `ts-loader` with `configFile: 'tsconfig.main.json'`.
- `vitest.config.ts` — Vitest config; includes `src/**/*.test.ts`. Tests use vitest's built-in TS handling, not the tsconfig files.
- `src/main/audio.test.ts`, `src/main/settings.test.ts`, `src/main/soniox.test.ts`, `src/main/window.test.ts` — Test files caught by the `src/main/**/*` include glob.

## Architecture

This is an Electron app with separate TypeScript configs for main and renderer processes. Webpack builds each process using `ts-loader`, which reads the corresponding tsconfig. The `include` glob in `tsconfig.main.json` (`src/main/**/*`) inadvertently captures `*.test.ts` files, pulling test-only types (e.g., vitest's `vi.fn()`) into the production build. Vitest runs tests independently using its own TypeScript handling, so excluding test files from the tsconfig won't affect test execution.
