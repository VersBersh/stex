# Discovered Tasks for T10

1. **BUILD: Exclude test files from tsconfig.main.json**
   - Description: `tsconfig.main.json` includes `src/main/**/*` which picks up `*.test.ts` files for webpack compilation. Add an `exclude` pattern for test files.
   - Why: Discovered during build verification — webpack compiles test files unnecessarily, and type issues in test mocks (vi.fn() types) can cause false build failures.
