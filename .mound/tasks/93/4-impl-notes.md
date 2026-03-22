# Implementation Notes

## Files created or modified

- `src/main/soniox.integration.test.ts` (created) — Integration test that connects to real Soniox API, sends PCM audio, and verifies the round-trip completes
- `vitest.config.ts` (modified) — Added `exclude: ['**/*.integration.test.ts']` to prevent integration tests from running with `npm test`
- `vitest.integration.config.ts` (created) — Separate vitest config for integration tests with 30s timeout
- `package.json` (modified) — Added `test:integration` script

## Deviations from plan

- Used a separate config file (`vitest.integration.config.ts`) instead of vitest projects/workspaces, which is simpler and more reliable across vitest versions.
- The `test:integration` script uses `--config vitest.integration.config.ts` instead of `--project integration`.

## New tasks or follow-up work

- **Spec drift in `spec/api.md`**: The plan review identified that `spec/api.md` has stale values (endpoint URL, field names, audio format, final-token semantics) that don't match the current implementation. This should be addressed in a separate task.
