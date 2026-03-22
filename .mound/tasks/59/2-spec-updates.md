# Spec Updates

## Spec changes required

### `spec/architecture.md` — line 72

**Current text:**
> **Hotkey Manager** | Registers the global hotkey via `globalShortcut`, sends show/hide commands to Window Manager

**Problem:** The Hotkey Manager actually routes through the Session Manager (`requestToggle()` in `session.ts`), not the Window Manager. This spec drift predates this task (it was introduced in T30 when session lifecycle was wired up), but removing `toggleOverlay()` makes the inaccuracy more visible — the described path no longer even has a plausible target function.

**Proposed change:** Update to:
> **Hotkey Manager** | Registers the global hotkey via `globalShortcut`, triggers session toggle via Session Manager

## New spec content

None.
