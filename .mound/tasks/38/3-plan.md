# Plan

## Goal

Add `"exclude": ["**/*.test.ts", "**/*.spec.ts"]` to `tsconfig.renderer.json` to match the exclusion pattern in `tsconfig.main.json`.

## Steps

1. **Edit `tsconfig.renderer.json`** — Add the `"exclude"` array after the `"include"` array, using the exact same pattern as `tsconfig.main.json`: `"exclude": ["**/*.test.ts", "**/*.spec.ts"]`.

## Risks / Open Questions

None. This is a minimal, safe configuration change with no behavioral impact on the current build (no test files exist under `src/renderer/` or `src/shared/` today).
