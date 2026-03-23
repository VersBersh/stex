# Plan

## Goal

Mask the API key in the settings UI after save (showing only last 4 characters), encrypt the API key at rest using Electron's `safeStorage` API, and prevent the plaintext key from being sent to renderers.

## Steps

### 1. Encrypt API key at rest using `safeStorage` (`src/main/settings.ts`)

Currently, `sonioxApiKey` is stored as a plain string in `settings.json`. Change storage to encrypt the value using Electron's `safeStorage` API:

- Add `import { safeStorage } from 'electron';`
- Add helper functions with migration support for existing plaintext values:
  ```typescript
  function encryptApiKey(plaintext: string): string {
    if (!plaintext) return '';
    return safeStorage.encryptString(plaintext).toString('base64');
  }

  function decryptApiKey(stored: string): string {
    if (!stored) return '';
    try {
      return safeStorage.decryptString(Buffer.from(stored, 'base64'));
    } catch {
      // Legacy plaintext value — return as-is for migration
      return stored;
    }
  }
  ```
- The `decryptApiKey` catch-block handles migration: existing plaintext values that aren't valid encrypted blobs will simply be returned as-is. On the next `setSetting('sonioxApiKey', ...)`, the value will be encrypted.
- Modify `setSetting()`: when `key === 'sonioxApiKey'`, encrypt the value before writing to the store.
- Modify `getSettings()`: after reading `sonioxApiKey` from the store, decrypt it before applying `resolveSonioxApiKey()`.

### 2. Add masking helper and `getSettingsForRenderer()` (`src/main/settings.ts`)

Add a function that masks an API key for display:

```typescript
function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 4) return key;
  return '\u2022'.repeat(key.length - 4) + key.slice(-4);
}
```

Add `getSettingsForRenderer()` that returns settings with `sonioxApiKey` replaced by the masked value:

```typescript
export function getSettingsForRenderer(): AppSettings {
  const settings = getSettings();
  return { ...settings, sonioxApiKey: maskApiKey(settings.sonioxApiKey) };
}
```

### 3. Use `getSettingsForRenderer()` in IPC handlers (`src/main/settings.ts`)

Modify `registerSettingsIpc()`:
- Change `SETTINGS_GET` handler to return `getSettingsForRenderer()` instead of `getSettings()`.
- Change `SETTINGS_SET` handler's broadcast to send `getSettingsForRenderer()` instead of `getSettings()`.
- The main-process `onSettingsChanged` listeners continue to receive full settings via `getSettings()` (these are used for Soniox connection, etc.).

### 4. Update ApiKey component (`src/renderer/settings/pages/ApiKey.tsx`)

Redesign the component for display/edit modes:

- **Display mode** (key is saved, `settings.sonioxApiKey` is a masked string like `••••abcd`): Show a read-only text input with the masked value. Show a "Change" button to enter edit mode.
- **Edit mode** (user wants to change key): Show an empty password input. Show "Save" and "Cancel" buttons. On save, call `onSettingChange('sonioxApiKey', newValue)` and return to display mode. On cancel, return to display mode.
- **Empty state** (no key saved): Show the password input with placeholder, like today. Show "Save" button.

Key changes:
- Remove `showKey` state and the Show/Hide button entirely (plaintext should never reach the renderer).
- Add `editing` state to toggle between display and edit modes.
- The component receives the masked key via `settings.sonioxApiKey` (already masked by the IPC layer).

### 5. Handle optimistic state update in parent (`src/renderer/settings/index.tsx`)

The parent's `handleSettingChange` currently sets `settings.sonioxApiKey` to the raw submitted value optimistically. For `sonioxApiKey`, we should not do this — instead, let the IPC broadcast update the state with the masked value.

Modify `handleSettingChange`: when `key === 'sonioxApiKey'`, don't optimistically update the local state. Just call `settingsApi.setSetting()` and wait for the `settings:updated` broadcast to arrive with the masked value.

### 6. Update settings tests (`src/main/settings.test.ts`)

Add a mock for `safeStorage` in the test setup:
```typescript
vi.mock('electron', () => ({
  ipcMain: { ... },
  BrowserWindow: { ... },
  safeStorage: {
    encryptString: (text: string) => Buffer.from(`enc:${text}`),
    decryptString: (buf: Buffer) => {
      const s = buf.toString();
      if (!s.startsWith('enc:')) throw new Error('decrypt failed');
      return s.slice(4);
    },
  },
}));
```

Add tests for:
- `setSetting('sonioxApiKey', 'my-key')` stores an encrypted (non-plaintext) value in the store.
- `getSettings()` returns the decrypted plaintext key (for main-process consumers).
- `getSettingsForRenderer()` returns masked `sonioxApiKey`.
- `maskApiKey` returns `••••abcd` format.
- Legacy plaintext values are handled gracefully by `decryptApiKey`.
- `SETTINGS_GET` IPC handler returns masked key.
- `SETTINGS_SET` IPC handler's broadcast contains masked key.

### 7. Update spec files

Apply the spec changes from `2-spec-updates.md`:

**`spec/models.md`**: Add note to `sonioxApiKey` resolution table that the stored value is encrypted with `safeStorage`. Add note that renderer-facing IPC returns masked display value.

**`spec/architecture.md`**: Add note to Settings Store responsibility that renderer-facing IPC returns masked `sonioxApiKey`.

## Risks / Open Questions

1. **`safeStorage` availability**: `safeStorage.isEncryptionAvailable()` may return `false` in some Linux environments without a keyring. This is a Windows desktop app, so we assume it's available. If needed later, a fallback can be added.

2. **Migration**: Existing users with plaintext API keys in `settings.json` are handled by the `try/catch` in `decryptApiKey`. The plaintext value is returned as-is on read, and will be re-encrypted on the next save. No data loss occurs.

3. **Show/Hide removal**: Removing the Show/Hide toggle is deliberate — once saved, the plaintext key should not be retrievable from the renderer. Users who need to see their key can look it up in their Soniox account.

4. **No separate masked-key IPC channel needed**: Since `settings:get` and `settings:updated` now return masked `sonioxApiKey`, a separate `settings:get-masked-key` channel would be redundant. This keeps the API surface minimal.

5. **Both preloads affected**: Both `src/preload/index.ts` (overlay) and `src/preload/settings-preload.ts` (settings) use `settings:get` and `settings:updated`. Since masking happens at the IPC handler level in `registerSettingsIpc()`, both preloads automatically receive masked values without any preload code changes. No preload or type changes needed.
