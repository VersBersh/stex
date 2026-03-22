# Struggles for T10

## 1. vi.hoisted and ESM import ordering
- **Category**: tooling
- **What happened**: The test file initially used `import { EventEmitter } from 'events'` at the top level and referenced it inside `vi.hoisted()`. This failed because `vi.hoisted` runs before ESM imports are resolved, so `EventEmitter` was undefined.
- **What would have helped**: Better documentation or examples in vitest docs about using Node built-in modules inside `vi.hoisted()` blocks. The `require()` workaround is not obvious.

## 2. ts-loader compiling test files
- **Category**: tooling
- **What happened**: The webpack build compiles all files matching `tsconfig.main.json`'s include pattern (`src/main/**/*`), which includes test files. Mock types from vitest (`vi.fn()`) don't satisfy the strict function type signatures expected by the implementation interfaces, causing type errors in webpack but not in vitest (which uses its own type resolution).
- **What would have helped**: The tsconfig.main.json should exclude test files from compilation. This is a pre-existing issue in the project setup.
