# T20 Discovered Tasks

1. **SETTINGS: T3 must integrate `resolveSonioxApiKey` into Settings Store**
   - When T3 implements the Settings Store with electron-store, it must call `resolveSonioxApiKey(store.get('sonioxApiKey'))` to compute the effective API key, and must not write the resolved env var value back to `settings.json`.
   - Discovered because T20 provides the fallback logic but T3 owns the integration point.

2. **UX: T19 first-run flow should account for env var fallback**
   - The first-run detection in `spec/features/system-tray.md` says "no API key configured" triggers setup. With T20, `SONIOX_API_KEY` env var counts as "configured". T19 should use `resolveSonioxApiKey` to check if a key is available before triggering the first-run flow.
   - Discovered from plan review noting spec/UX interaction.

3. **INFRA: Add `engines` field to package.json**
   - vitest v4 requires Node >= 20.19.0 or >= 22.12.0. The project has no `engines` declaration, which could cause confusing failures for developers on older Node versions.
   - Discovered from design review flagging undeclared Node runtime requirement.
