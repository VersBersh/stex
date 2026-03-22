# Spec Updates

## Spec changes required

### `spec/features/system-tray.md` — First-Run Experience condition (line 18)

**Current:** `On first launch (no settings.json exists or no API key configured):`

**Change to:** `On first launch (no API key available — see [Stored vs Effective Settings](../models.md#stored-vs-effective-settings)):`

**Why:** The current wording implies a file-existence check and doesn't account for the `SONIOX_API_KEY` environment variable fallback. The code checks the *effective* API key via `getSettings()`, which resolves env var fallback. The spec should match the code and be consistent with `spec/models.md` line 108-116 and `spec/architecture.md` line 73, both of which define the effective settings contract.

### `spec/features/system-tray.md` — Hotkey without API key (line 22)

**Current:** `If the user presses the global hotkey without an API key configured, the overlay shows...`

**Change to:** `If the user presses the global hotkey without an API key available, the overlay shows...`

**Why:** Same reason — "configured" could be read as "persisted in settings.json." "Available" aligns with the effective settings contract and is consistent with the resolution precedence defined elsewhere.
