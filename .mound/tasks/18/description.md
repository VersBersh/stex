# T18: Theming

## Summary

Implement light, dark, and system-following theme support for both the overlay and settings windows.

## Scope

- Support three theme modes: `"system"`, `"light"`, `"dark"` (from `AppSettings.theme`)
- **System theme**: follow Windows system theme via `nativeTheme.shouldUseDarkColors` and listen for changes
- Apply theme to:
  - Overlay window (editor area, title bar, status bar, error banner)
  - Settings window
- Minimal color palette — utility app aesthetic
- Ghost text colors per theme:
  - Light: `#999`
  - Dark: `#666`
- CSS variables or theme context for consistent theming across components
- Theme changes apply immediately when setting is changed (no restart)

## Acceptance Criteria

- Light and dark themes are visually distinct and complete
- System theme follows Windows dark/light mode
- Theme changes apply immediately without restart
- Ghost text uses correct muted colors per theme
- Both overlay and settings windows respect the theme

## References

- `spec/ui.md` — themes, ghost text colors
- `spec/models.md` — `AppSettings.theme`
