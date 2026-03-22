# T20 Implementation Notes

## Files created or modified

| File | Summary |
|------|---------|
| `src/main/settings.ts` | Replaced placeholder with `resolveSonioxApiKey(savedValue)` function |
| `src/main/settings.test.ts` | Created tests covering all acceptance criteria |
| `package.json` | Added `vitest` dev dependency and `test` script |
| `vitest.config.ts` | Created minimal vitest config |

## Deviations from plan

- Removed unused `beforeEach` import from test file (caught in review).

## New tasks or follow-up work

- T3 must call `resolveSonioxApiKey(store.get('sonioxApiKey'))` when computing the effective API key, rather than using the raw stored value directly.
- T3 must ensure the resolved env var value is not written back to `settings.json` (to satisfy AC #4 "no secrets written to disk").
- T19 should account for the env var fallback when determining first-run state — a user with `SONIOX_API_KEY` set should not see the first-run flow.
