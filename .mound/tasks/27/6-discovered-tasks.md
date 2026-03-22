# Discovered Tasks

1. **BUILD: Mirror test file exclusion in tsconfig.renderer.json**
   - Description: Add the same `"exclude": ["**/*.test.ts", "**/*.spec.ts"]` to `tsconfig.renderer.json` for consistency. Currently no test files exist under `src/renderer/` or `src/shared/`, but the exclusion would prevent future test files from being compiled into the renderer bundle.
   - Why discovered: Design review flagged that only `tsconfig.main.json` has the exclusion, creating a partial policy that relies on developers remembering to update both tsconfigs.
