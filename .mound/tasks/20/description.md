# T20: Environment Variable Fallback for Soniox API Key

## Summary

Update the Settings Store to read `process.env.SONIOX_API_KEY` as the default/fallback value for `sonioxApiKey` when no key has been explicitly saved in `settings.json`. This allows developers and worktrees to use the API key without storing it in the repo or in per-worktree `.env` files.

## Scope

- In the Settings Store (`src/main/settings.ts`, created in T3), modify the `sonioxApiKey` default:
  - If `settings.json` has a non-empty `sonioxApiKey`, use it (existing behavior)
  - Otherwise, fall back to `process.env.SONIOX_API_KEY ?? ""`
- The env var is read once at startup (or when settings are loaded), not polled continuously
- No changes to the settings UI — users can still save a key via the Settings window, which takes precedence

## Acceptance criteria

- When `sonioxApiKey` is empty in `settings.json` and `SONIOX_API_KEY` env var is set, the app uses the env var value
- When `sonioxApiKey` is non-empty in `settings.json`, it takes precedence over the env var
- When neither is set, the value remains `""` (triggering the first-run flow as designed)
- No secrets are written to disk or committed to git

## References

- T3 (Settings Store) — where defaults are defined
- T10 (Soniox WebSocket Client) — first consumer that needs the key to connect
- `spec/architecture.md` — Settings Store responsibilities
