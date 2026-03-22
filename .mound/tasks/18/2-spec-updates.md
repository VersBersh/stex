# T18: Theming — Spec Updates

No spec updates required.

The spec already covers theming adequately:
- `spec/models.md` defines `AppSettings.theme: "system" | "light" | "dark"` with the correct type.
- `spec/ui.md` specifies light/dark mode support, system theme following, minimal color palette, and ghost text colors per theme (`#999` light, `#666` dark).

This task is pure implementation — the contracts and requirements are already specified. No changes to the models or UI spec are needed.
