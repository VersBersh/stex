# First-run detection should use resolved API key (env var fallback)

## Summary
`spec/features/system-tray.md` line 18 says "no API key configured" triggers first-run setup. With the `resolveSonioxApiKey` function (implemented in T20/T23), the `SONIOX_API_KEY` environment variable counts as "configured." T19's first-run detection logic must use the resolved key (not just the persisted value) to determine whether an API key is available.

This was originally discovered during T20 and re-confirmed during T23 plan review.

## Acceptance criteria
- First-run detection checks the resolved API key (via `resolveSonioxApiKey` or the effective settings from the Settings Store) rather than only the persisted value.
- If `SONIOX_API_KEY` env var is set, the user is NOT prompted for API key entry during first-run.
- Other first-run checks (mic permission, hotkey conflict) still run as specified.

## References
- Discovered in T20, re-confirmed in T23: `.mound/tasks/23/6-discovered-tasks.md` item #2
- Related: T19 (First-Run Experience), T20 (Environment variable fallback), T23 (resolveSonioxApiKey integration)
- `spec/features/system-tray.md` line 18
