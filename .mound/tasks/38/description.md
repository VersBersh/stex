# BUILD: Mirror test file exclusion in tsconfig.renderer.json

## Summary
Task 27 added `"exclude": ["**/*.test.ts", "**/*.spec.ts"]` to `tsconfig.main.json` to prevent test files from being compiled into the webpack bundle. The same exclusion should be mirrored in `tsconfig.renderer.json` for consistency. Currently no test files exist under `src/renderer/` or `src/shared/`, but adding the exclusion now prevents future test files from accidentally being compiled into the renderer bundle.

## Acceptance criteria
- `tsconfig.renderer.json` includes `"exclude": ["**/*.test.ts", "**/*.spec.ts"]` (or equivalent pattern matching the one in `tsconfig.main.json`)
- The renderer webpack build still compiles correctly after the change
- The exclusion pattern is consistent between `tsconfig.main.json` and `tsconfig.renderer.json`

## References
- Source: `.mound/tasks/27/6-discovered-tasks.md` (discovered during task 27: Exclude test files from tsconfig.main.json)
- `tsconfig.renderer.json` — target file
- `tsconfig.main.json` — reference for existing exclusion pattern
