# T18: Theming — Struggles

No major struggles. The task was well-scoped and the codebase was straightforward to work with.

- **Category**: `tooling`
- **What happened**: `npm install` fails due to native module build errors (`segfault-handler`, `naudiodon`), requiring `--ignore-scripts`. The `soniox.test.ts` suite also fails because `electron` binary isn't installed.
- **What would have helped**: A documented `npm install --ignore-scripts` workaround or a separate test script that skips suites requiring native binaries.
