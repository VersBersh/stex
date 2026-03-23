# Spec Updates

## Spec changes required

### 1. `spec/models.md` — Document encrypted storage and renderer-safe masking

**What needs to change:** The `AppSettings` model section (around line 115) and the "Stored vs Effective Settings" section (around line 127) currently describe `sonioxApiKey` as a plain string with env var resolution. The implementation changes the storage representation (encrypted at rest) and adds a renderer/main-process distinction for the field.

**Changes:**
- Add a note to the `sonioxApiKey` field that the stored representation is encrypted using `safeStorage` (base64-encoded), not plaintext.
- Add to the "Stored vs Effective Settings" section: renderer-facing IPC (`settings:get`, `settings:updated`) returns `sonioxApiKey` as a masked string (e.g., `••••abcd`) for display purposes only. Main-process `getSettings()` continues to return the decrypted effective key.

### 2. `spec/architecture.md` — Document renderer-safe settings contract

**What needs to change:** The Settings Store description (line 73) and IPC table (around line 131) describe `settings:get` and `settings:updated` as returning `AppSettings`. After this change, the `sonioxApiKey` field in renderer-facing responses will be masked, not the effective key.

**Changes:**
- Add a note to the Settings Store responsibility: "Renderer-facing IPC returns `sonioxApiKey` as a masked display value; main-process `getSettings()` returns the decrypted effective key."
