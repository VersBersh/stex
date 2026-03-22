# Integrate resolveSonioxApiKey into Settings Store

## Summary
The Settings Store (T3, now complete) must integrate the `resolveSonioxApiKey` function (from T20) to compute the effective Soniox API key. When retrieving the API key, the store should call `resolveSonioxApiKey(store.get('sonioxApiKey'))` so that the env var fallback (`SONIOX_API_KEY`) is applied. The resolved env var value must NOT be written back to `settings.json` — it should only be used at runtime.

## Acceptance criteria
- `getSettings()` (or equivalent accessor) returns the resolved API key using `resolveSonioxApiKey`.
- The env var fallback value is never persisted to the settings file on disk.
- Unit tests verify that when no user-configured key exists, the env var fallback is used at runtime.
- Unit tests verify that a user-configured key takes precedence over the env var.

## References
- T20 (task 20): Environment variable fallback for Soniox API key — provides `resolveSonioxApiKey`
- T3 (task 3): Settings Store — the integration target
- Source: `.mound/tasks/20/6-discovered-tasks.md` item 1
