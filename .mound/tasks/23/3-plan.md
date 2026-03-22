# T23 Plan — Integrate resolveSonioxApiKey into Settings Store

## Goal

Verify that the `resolveSonioxApiKey` integration into the Settings Store is complete and all acceptance criteria are satisfied (the integration was already implemented by T3 and T20).

## Current State

The integration described in this task is **already implemented**:

1. `resolveSonioxApiKey()` is defined at `src/main/settings.ts:12-17` (added by T20)
2. `getSettings()` calls `resolveSonioxApiKey(result.sonioxApiKey)` at `src/main/settings.ts:45` (added by T3)
3. The resolved value is only applied to the returned object — never written back to the `electron-store` instance
4. Tests at `src/main/settings.test.ts:149-169` verify:
   - Env var fallback when saved key is empty (line 149)
   - No write-back of resolved value (line 156)
   - Saved key takes precedence over env var (line 164)

## Steps

1. **Verify tests pass** — Run `npx vitest run src/main/settings.test.ts` to confirm all existing tests pass.
2. **Verify build compiles** — Run `npm run build` to ensure no type/build errors.
3. **No code changes needed** — All acceptance criteria are already satisfied by existing code and tests.

## Risks / Open Questions

- **Risk: Task is a no-op** — T3 already implemented this integration. The task was created from T20's discovered tasks, but T3 (which ran after T20) already included the integration. This task serves as verification that the integration is correct.

- **Spec inconsistency (system-tray.md)** — The reviewer flagged that `spec/features/system-tray.md` line 18 says "no API key configured" triggers first-run setup, which doesn't account for env var fallback. This is **already tracked** as T20 discovered task #2 ("UX: T19 first-run flow should account for env var fallback") and is out of scope for T23. Will be noted as a discovered task.

- **Spec inconsistency (models.md)** — The reviewer flagged that `spec/models.md` describes `AppSettings` as "Persisted user preferences" but `sonioxApiKey` returned by `getSettings()` may be env-derived. This is a documentation concern. Modifying shared spec files (models.md, architecture.md) risks cross-task conflicts and is better handled as a dedicated spec-cleanup task. Will be noted as a discovered task.

- **The existing tests are comprehensive** and cover all acceptance criteria. No additional tests are needed.
