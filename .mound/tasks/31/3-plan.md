# Plan

## Goal

Document the distinction between stored (persisted) and effective (resolved) settings in `spec/models.md` and `spec/architecture.md`, including the `sonioxApiKey` resolution precedence.

## Steps

### Step 1: Update `spec/models.md` — AppSettings section

**File:** `spec/models.md` (lines 87–106)

**Changes:**

1. Replace the one-line description "Persisted user preferences." (line 89) with a paragraph that explains AppSettings represents both the persisted schema and the effective shape returned by `getSettings()`.

2. After the interface code block (after line 106), add a new subsection "### Stored vs Effective Settings" that documents:
   - The distinction: the interface defines both the on-disk schema and the runtime shape.
   - `sonioxApiKey` resolution precedence: non-empty saved value > `SONIOX_API_KEY` env var > empty string.
   - The resolved env var value is never persisted to `settings.json`.
   - All other defined `AppSettings` fields are read directly from the store (with defaults applied by `electron-store`) without additional runtime resolution.

### Step 2: Update `spec/architecture.md` — Settings Store row

**File:** `spec/architecture.md` (line 73)

**Changes:**

Update the Settings Store description in the Component Responsibilities table to add a sentence about runtime resolution. Change from:

> Reads/writes `settings.json` using `electron-store` or similar. Exposes settings to both renderers via IPC

To:

> Reads/writes `settings.json` using `electron-store` or similar. Exposes settings to both renderers via IPC. `getSettings()` returns *effective* settings: for `sonioxApiKey`, the store applies resolution precedence (non-empty saved value > `SONIOX_API_KEY` env var > empty string) — the resolved value is never written back to disk

## Risks / Open Questions

- **None significant.** This is a spec-only documentation task with no code changes. The main risk is wording that doesn't match the implementation, mitigated by having read `src/main/settings.ts` directly.
- The review noted that "all other fields are returned as-is" is slightly loose — `electron-store` applies defaults for missing keys. The revised wording clarifies this.
