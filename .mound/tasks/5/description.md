# T5: System Tray

## Summary

Implement the System Tray module with icon and right-click context menu.

## Scope

- Create `src/main/tray.ts`
- Create system tray icon (use a placeholder icon initially)
- Right-click context menu with three items:
  - **Show/Hide** — toggle overlay window visibility via Window Manager
  - **Settings** — open settings window via Window Manager
  - **Quit** — exit the application (`app.quit()`)
- Tray icon is always visible when the app is running

## Acceptance Criteria

- Tray icon appears in the Windows system tray on app launch
- Right-click shows context menu with Show/Hide, Settings, and Quit options
- Show/Hide toggles the overlay window
- Settings opens the settings window
- Quit exits the application
- Tray icon persists across show/hide cycles

## References

- `spec/features/system-tray.md` — tray menu items and behavior
- `spec/architecture.md` — Tray Manager responsibilities
