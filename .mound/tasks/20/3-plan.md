# T20 Plan

## Goal

Add environment variable fallback for `sonioxApiKey` in the Settings Store so that `process.env.SONIOX_API_KEY` is used when no key is saved in `settings.json`.

## Steps

### 1. Implement `resolveSonioxApiKey()` in `src/main/settings.ts`

Replace the placeholder with a function that encapsulates the full resolution logic:

```typescript
export function resolveSonioxApiKey(savedValue: string): string {
  if (savedValue) {
    return savedValue;
  }
  return process.env.SONIOX_API_KEY ?? "";
}
```

This function takes the saved/persisted value and applies the precedence rules:
1. Non-empty saved value wins (from `settings.json`)
2. Fall back to `process.env.SONIOX_API_KEY` if saved value is empty
3. Return `""` if neither is set

T3 (Settings Store) will call this function when resolving the effective `sonioxApiKey` value — e.g., in a getter or when computing defaults after loading from disk.

**Files**: `src/main/settings.ts`
**Dependencies**: None

### 2. Add test framework and write tests

Install vitest and write tests covering all acceptance criteria:

- `npm install --save-dev vitest`
- Add `"test": "vitest run"` to `package.json` scripts
- Create `vitest.config.ts` with minimal config
- Create `src/main/settings.test.ts` with tests:
  1. Non-empty saved value takes precedence over env var (AC #2)
  2. Empty saved value + env var set → returns env var value (AC #1)
  3. Empty saved value + no env var → returns `""` (AC #3)
  4. Saved value is whitespace-only → still treated as non-empty (saved value wins)

Tests manipulate `process.env.SONIOX_API_KEY` directly and call `resolveSonioxApiKey()` with different `savedValue` arguments. No mocking of electron-store needed — the function is pure logic.

**Files**: `package.json`, `vitest.config.ts`, `src/main/settings.test.ts`
**Dependencies**: Step 1

## Risks / Open Questions

- **T3 integration**: The function is not yet called from a Settings Store class because T3 hasn't been implemented. T3 will need to call `resolveSonioxApiKey(store.get('sonioxApiKey'))` when computing the effective API key. This is intentional — T20's scope is the fallback logic, not the full store.
- **Spec update for first-run flow**: The reviewer noted that `spec/features/system-tray.md` line 18 says "no API key configured" — with T20, an env var counts as "configured." However, updating that spec is T19's responsibility (first-run experience), not T20's. T20 only provides the resolution mechanism. Noted here so T19 can account for it.
- **No secrets written to disk**: The env var value is only returned at runtime and never persisted by this function. T3 must ensure it doesn't write the resolved env var value back to `settings.json`.
