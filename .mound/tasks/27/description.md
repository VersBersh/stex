# Exclude test files from tsconfig.main.json webpack compilation

## Summary
`tsconfig.main.json` includes `src/main/**/*` which picks up `*.test.ts` files for webpack compilation. This causes unnecessary compilation of test files and can produce false build failures when test mocks (e.g., `vi.fn()` types) don't match production type expectations. An `exclude` pattern should be added for test files.

## Acceptance criteria
- `tsconfig.main.json` has an `exclude` entry that excludes `**/*.test.ts` (and `**/*.spec.ts` if applicable) from compilation.
- `npm run build` (or equivalent) no longer compiles test files in `src/main/`.
- Existing tests continue to run successfully (they use their own tsconfig or vitest's built-in TS handling).

## References
- T10 (task 10): Soniox WebSocket Client — discovered during build verification
- Source: `.mound/tasks/10/6-discovered-tasks.md` item 1
