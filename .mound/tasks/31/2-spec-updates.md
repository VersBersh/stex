# Spec Updates Required

## 1. `spec/models.md` — AppSettings section

**What needs to change:** The `AppSettings` section (lines 87–106) currently has the heading "Persisted user preferences" with no mention of runtime resolution. It needs to:

1. Change the description to clarify that `AppSettings` represents both the stored schema and the effective (resolved) shape returned by `getSettings()`.
2. Add a note after the interface definition explaining that `sonioxApiKey` has runtime resolution: non-empty saved value > `SONIOX_API_KEY` env var > empty string.
3. Clarify that the resolved env var value is never persisted to disk.

**Why:** `getSettings()` returns an `AppSettings` object where `sonioxApiKey` may be environment-derived, not persisted. The spec currently implies all fields are purely persisted, which is inaccurate after T20/T23.

## 2. `spec/architecture.md` — Settings Store row

**What needs to change:** The Settings Store description in the Component Responsibilities table (line 73) currently says: "Reads/writes `settings.json` using `electron-store` or similar. Exposes settings to both renderers via IPC". It should additionally mention that `getSettings()` returns effective settings with runtime resolution (e.g., env var fallback for `sonioxApiKey`), and that resolved values are not written back to disk.

**Why:** The architecture doc should reflect the actual behavior of the Settings Store component, which now has a resolution layer between stored and exposed settings.
