# T3: Settings Store

## Summary

Implement the Settings Store module in the main process using `electron-store` to persist `AppSettings` with sensible defaults and expose settings to renderers via IPC.

## Scope

- Create `src/main/settings.ts`
- Use `electron-store` (or similar) to read/write `AppSettings` to disk
- Define sensible defaults for all `AppSettings` fields:
  - `hotkey`: `"Ctrl+Shift+Space"`
  - `launchOnStartup`: `false`
  - `onHide`: `"clipboard"`
  - `onShow`: `"fresh"`
  - `audioInputDevice`: `null` (system default)
  - `sonioxApiKey`: `""` (empty — triggers first-run)
  - `sonioxModel`: `"stt-rt-preview"`
  - `language`: `"en"`
  - `maxEndpointDelayMs`: `1000`
  - `theme`: `"system"`
  - `windowPosition`: `null`
  - `windowSize`: `{ width: 600, height: 300 }`
- Expose IPC handlers:
  - Renderer can read current settings
  - Renderer can update individual settings
  - Main process broadcasts `settings:updated` to all renderers on change

## Acceptance Criteria

- Settings persist across app restarts (written to disk)
- Default values are applied on first launch
- Settings are readable and writable from renderer processes via IPC
- `settings:updated` IPC message is sent to all windows when a setting changes
- TypeScript types match `AppSettings` from `src/shared/types.ts`

## References

- `spec/models.md` — `AppSettings` interface
- `spec/architecture.md` — Settings Store responsibilities
