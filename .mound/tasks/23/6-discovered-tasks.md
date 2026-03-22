# T23 Discovered Tasks

1. **SPEC: Clarify stored vs effective settings in models.md and architecture.md**
   - `spec/models.md` describes `AppSettings` as "Persisted user preferences" but `getSettings()` now returns an effective `sonioxApiKey` that may be env-derived (not persisted). The spec should document the stored-vs-effective distinction and the resolution precedence (saved > env > empty). `spec/architecture.md` line 73 should also mention this resolution rule under the Settings Store description.
   - Discovered because the plan review flagged the inconsistency between the spec documentation and the implemented behavior.

2. **UX: First-run flow should account for env var fallback** (re-confirming T20 discovered task #2)
   - `spec/features/system-tray.md` line 18 says "no API key configured" triggers first-run setup. With `resolveSonioxApiKey`, `SONIOX_API_KEY` env var counts as "configured." T19's first-run detection should use the resolved key to determine availability.
   - Re-confirmed during T23 plan review; originally discovered in T20.
