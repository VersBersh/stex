# SPEC: Clarify stored vs effective settings in models.md and architecture.md

## Summary
`spec/models.md` describes `AppSettings` as "Persisted user preferences" but `getSettings()` now returns an effective `sonioxApiKey` that may be environment-derived (not persisted). The spec should document the stored-vs-effective distinction and the resolution precedence (saved > env > empty). `spec/architecture.md` should also mention this resolution rule under the Settings Store description.

This inconsistency was discovered during T23 (resolveSonioxApiKey integration) when the plan review flagged the gap between spec documentation and implemented behavior.

## Acceptance criteria
- `spec/models.md` distinguishes between stored (persisted) settings and effective (resolved) settings for `AppSettings`.
- The resolution precedence for `sonioxApiKey` is documented: saved value > `SONIOX_API_KEY` env var > empty string.
- `spec/architecture.md` Settings Store section mentions the resolution rule.
- No code changes required — this is a spec-only task.

## References
- Discovered in T23: `.mound/tasks/23/6-discovered-tasks.md` item #1
- Related: T20 (Environment variable fallback for Soniox API key), T3 (Settings Store)
- `spec/models.md`, `spec/architecture.md`
