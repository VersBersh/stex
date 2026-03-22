# T23 Implementation Notes

## Files created or modified

No source code files were created or modified. The integration of `resolveSonioxApiKey` into the Settings Store was already complete, implemented by:
- T20 (commit 06fae2c): Added `resolveSonioxApiKey()` to `src/main/settings.ts`
- T3 (commit bb36372): Integrated the call into `getSettings()` at line 45, added comprehensive tests

## Deviations from the plan

None — the plan correctly identified this as a verification-only task.

## Verification results

- All 69 tests pass (3 test files)
- Settings-specific tests (17 tests) all pass, including:
  - `resolveSonioxApiKey` unit tests (4 tests)
  - `getSettings` integration tests verifying env var fallback, no write-back, and saved key precedence (4 tests)

## New tasks or follow-up work

1. **SPEC: Clarify stored vs effective settings in models.md and architecture.md** — `spec/models.md` describes `AppSettings` as "Persisted user preferences" but `getSettings()` returns an effective `sonioxApiKey` that may be env-derived and not persisted. The spec should document the stored-vs-effective distinction and the resolution precedence (saved > env > empty).

2. **UX: T19 first-run flow should account for env var fallback** (re-confirming T20 discovered task #2) — `spec/features/system-tray.md` line 18 says "no API key configured" triggers first-run setup. With env var fallback, `SONIOX_API_KEY` counts as "configured." The first-run flow should use `resolveSonioxApiKey` to check availability.
