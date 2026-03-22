# Plan

## Goal

Ensure first-run detection uses the resolved API key (with env var fallback), update the spec to match, and add explicit test coverage for the env var scenario.

## Steps

### 1. Update spec: `spec/features/system-tray.md`

**Line 18:** Change `On first launch (no settings.json exists or no API key configured):` to `On first launch (no API key available — see [Stored vs Effective Settings](../models.md#stored-vs-effective-settings)):`

**Line 22:** Change `without an API key configured` to `without an API key available`.

These changes align the spec with the effective settings contract already defined in `spec/models.md` (line 108-116) and `spec/architecture.md` (line 73).

### 2. Add env var fallback test to `src/main/first-run.test.ts`

Add a test case after the existing "does not open settings when API key exists" test (line 96). This test documents the contract that env-var-resolved keys count as "available":

```typescript
it('does not open settings when API key is resolved from environment variable', () => {
  // Simulates getSettings() resolving SONIOX_API_KEY env var as the effective key
  mockSettingsData.sonioxApiKey = 'env-resolved-key';
  initApp();
  expect(mockShowSettings).not.toHaveBeenCalled();
});
```

Note: Since `first-run.test.ts` mocks `getSettings()`, this test exercises the same code path as the existing "key exists" test. Its value is documentary — it makes the env var contract explicit. The actual env var resolution is tested in `settings.test.ts` line 150-155.

### 3. Verify no code change needed in `src/main/index.ts`

`initApp()` at line 20-23 already calls `getSettings()` which calls `resolveSonioxApiKey()`. The production code already correctly uses the resolved key. No code change needed.

### 4. Run tests

Run `src/main/first-run.test.ts` and `src/main/settings.test.ts` to verify everything passes.

## Risks / Open Questions

- **Minimal code change**: The production code is already correct since T23 integrated `resolveSonioxApiKey()` into `getSettings()`. This task is primarily about spec alignment and test documentation.
- **Mock-based test**: The new test uses the same mock as existing tests, so it doesn't exercise a unique code path. This is acceptable because the env var resolution is tested at the unit level in `settings.test.ts`.
