# Spec Updates

No spec updates required.

The system tray spec (`spec/features/system-tray.md`) already says "App icon appears in the system tray" without specifying how the icon is loaded or what it looks like. The architecture spec lists `tray.ts` with responsibility "Creates the system tray icon" — this doesn't change. The task is a pure implementation change (replacing a placeholder with a real icon) that doesn't affect any contracts, interfaces, or documented behavior.
