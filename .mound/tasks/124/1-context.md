# Context

## Relevant Files

- `.mound/config.toml` — Mound configuration file; currently has general settings but no `[test_runner]` section
- `package.json` — Defines `test` (`vitest run`) and `test:integration` scripts
- `vitest.config.ts` — Unit test config; includes `src/**/*.test.ts`, excludes integration tests
- `vitest.integration.config.ts` — Integration test config; includes `src/**/*.integration.test.ts`
- `.mound/instructions/test-failure.md` — Mound instruction for test-failure resolution tasks (consumer of test_runner config)
- `.mound/instructions/plan-and-implement.md` — Mound instruction for implementation tasks (consumer of test_runner config)

## Architecture

This is a Node.js/TypeScript Electron app ("stex") using **Vitest v4.1.0** as its test framework. Tests are split into:
- **Unit tests** — `vitest run` (default config), 585 tests across 33 files
- **Integration tests** — `vitest run --config vitest.integration.config.ts`

Vitest supports a built-in `junit` reporter (`--reporter=junit`) that outputs JUnit XML to stdout. It can also write to a file via `--outputFile`.

Targeted test execution uses `-t <test-name>` to filter by test name pattern.

The `.mound/config.toml` file is consumed by the Mound orchestration system to configure workers. The `[test_runner]` section tells Mound workers how to invoke the project's test suite during task implementation and verification.
