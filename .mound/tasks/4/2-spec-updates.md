# Spec Updates for T4: Window Manager

No spec updates required.

The existing specs (`spec/ui.md`, `spec/architecture.md`, `spec/features/system-tray.md`) fully define the Window Manager's overlay behavior, dimensions, opacity rules, animation, and position persistence.

Notes on implementation details not covered by spec:
- **Settings window dimensions** (600x500): No spec defines the settings window size. This is treated as a reasonable implementation default, not a spec-level decision.
- **Position validation rule**: The UI spec says "validates that the saved position is within the bounds of a connected display". The implementation uses rectangle intersection (does the window rectangle overlap any display's work area) which is the natural interpretation of "within bounds".
