# Plan

## Goal

Split `src/main/settings.test.ts` (483 lines) into 4 focused test files organized by concern, each under 300 lines, with no test coverage loss.

## Steps

### 1. Create `src/main/settings-defaults.test.ts` (~105 lines)

Contains the `resolveSonioxApiKey` and `APP_SETTINGS_DEFAULTS` describe blocks (lines 94-150 of the original).

Mock setup: needs `mockStore` for the module-level Store instantiation, the `electron-store` mock, and the `electron` mock. The `electron` mock can use inert stubs for `safeStorage` since these tests don't exercise encryption. Does NOT need `mockHandlers`, `mockWindows`, `mockShell`, `mockGetLogFilePath`, `mockExistsSync`, or the `./logger` and `fs` mocks.

Imports from `./settings`: `resolveSonioxApiKey`, `APP_SETTINGS_DEFAULTS`
Imports from shared: `AppSettings` type

### 2. Create `src/main/settings-store.test.ts` (~150 lines)

Contains the `getSettings`, `setSetting`, `onSettingsChanged` describe blocks (lines 152-262), PLUS the `getSettings does not leak unknown keys from store` test (line 316-321, currently inside `registerSettingsIpc` describe but actually tests store behavior).

Mock setup: needs `mockStore` and the full reversible `safeStorage` mock (encrypt/decrypt) because `getSettings()` decrypts API keys and `setSetting('sonioxApiKey', ...)` encrypts them. Does NOT need IPC/shell/logger/fs mocks.

Imports from `./settings`: `getSettings`, `setSetting`, `onSettingsChanged`

### 3. Create `src/main/settings-ipc.test.ts` (~185 lines)

Contains the `registerSettingsIpc` describe block (lines 264-398) MINUS the `getSettings does not leak unknown keys` test (moved to store file).

Mock setup: full — needs ALL mocks: `mockStore`, `mockHandlers`, `mockWindows`, `mockShell`, `mockGetLogFilePath`, `mockExistsSync`. Also needs the `./logger` and `fs` mocks. Needs the full reversible `safeStorage` mock.

Imports from `./settings`: `registerSettingsIpc`, `setSetting`, `getSettings`
Imports from shared: `AppSettings` type, `IpcChannels`

### 4. Create `src/main/settings-encryption.test.ts` (~140 lines)

Contains the `API key encryption` and `getSettingsForRenderer` describe blocks (lines 401-483).

Mock setup: needs `mockStore` and the full reversible `safeStorage` mock (encrypt/decrypt) because these tests directly exercise encryption and decryption behavior. Does NOT need IPC/shell/logger/fs mocks.

Imports from `./settings`: `setSetting`, `getSettings`, `getSettingsForRenderer`

### 5. Delete `src/main/settings.test.ts`

Remove the original file after all split files are created and tests pass.

### 6. Update stale reference in `src/main/first-run.test.ts`

Line 111 has a comment referencing `settings.test.ts`. Update it to reference `settings-store.test.ts` (where the referenced test now lives).

## Risks / Open Questions

- **Module-level side effects**: `settings.ts` creates a `Store` at module level. Each test file will get its own module instance due to Vitest isolation, so the `mockStore` Map needs to be in `vi.hoisted()` in each file. This is the established pattern from the window test split.
- **safeStorage mock fidelity**: The store, IPC, and encryption files all need the reversible `safeStorage` mock (not inert stubs) because `getSettings()` calls `decryptApiKey()` and `setSetting()` calls `encryptApiKey()`. Only the defaults file can safely use inert stubs.
