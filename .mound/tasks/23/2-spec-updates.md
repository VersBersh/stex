# T23 Spec Updates

No spec updates required for this task.

The integration of `resolveSonioxApiKey` into the Settings Store was already implemented by T3 and T20. No spec contracts need to change for this integration to work.

**Acknowledged spec inconsistencies (out of scope):**

1. `spec/features/system-tray.md` line 18 says "no API key configured" triggers first-run setup but doesn't account for env var fallback. Already tracked as T20 discovered task #2 — the first-run flow (T19) should use `resolveSonioxApiKey` to determine if a key is available.

2. `spec/models.md` describes `AppSettings` as "Persisted user preferences" but `getSettings()` now returns a resolved `sonioxApiKey` that may be env-derived (not persisted). A documentation update to clarify stored vs effective settings is warranted but belongs in a separate spec-cleanup task to avoid cross-task file conflicts.
