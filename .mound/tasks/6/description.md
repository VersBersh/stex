# T6: Global Hotkey Manager

## Summary

Implement the Global Hotkey Manager that registers a configurable global keyboard shortcut and dispatches show/hide commands to the Window Manager.

## Scope

- Create `src/main/hotkey.ts`
- Register global hotkey via Electron's `globalShortcut.register()`
- Default hotkey: `Ctrl+Shift+Space` (read from Settings Store)
- On hotkey press: toggle overlay window via Window Manager
- Handle registration failure: if another app has the hotkey, show a system notification directing user to Settings to pick a different one
- Re-register when the hotkey setting changes (listen for `settings:updated`)
- Unregister on app quit

## Acceptance Criteria

- Global hotkey toggles the overlay window from any application
- Hotkey is read from Settings Store (configurable)
- Registration failure shows a notification to the user
- Hotkey re-registers when the setting is changed
- Hotkey is unregistered on app quit

## References

- `spec/hotkeys.md` — global hotkey behavior
- `spec/features/system-tray.md` — hotkey registration failure handling
- `spec/architecture.md` — Hotkey Manager responsibilities
