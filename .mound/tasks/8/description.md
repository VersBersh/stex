# T8: Settings Window UI

## Summary

Build the settings window's React UI with pages for API key configuration, hotkey customization, audio input device selection, and behavior/theme preferences.

## Scope

- Create `src/renderer/settings/index.html` and `src/renderer/settings/index.tsx` (React entry)
- Page-based or tabbed layout with sections:
  - **API Key** (`src/renderer/settings/pages/ApiKey.tsx`): text input for Soniox API key, save button
  - **Hotkeys** (`src/renderer/settings/pages/Hotkeys.tsx`): hotkey input field for global shortcut
  - **General** (`src/renderer/settings/pages/General.tsx`):
    - Theme selector (system / light / dark)
    - `onShow` behavior (fresh / append)
    - `onHide` behavior (clipboard / none)
    - Launch on startup toggle
    - Audio input device dropdown (populated via IPC query to main process)
    - Soniox model and language settings
    - `maxEndpointDelayMs` slider (500–3000)
- All settings read/write via IPC to the Settings Store in main process

## Acceptance Criteria

- Settings window opens and displays all configuration options
- Changes are persisted via IPC to the Settings Store
- Settings values are loaded from the store on window open
- UI is functional and all controls work (inputs, dropdowns, toggles, sliders)

## References

- `spec/models.md` — `AppSettings` fields
- `spec/architecture.md` — Settings UI responsibilities
- `spec/features/system-tray.md` — settings window opened from tray menu
