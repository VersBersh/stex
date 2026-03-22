# Plan

## Goal

Remove the dead `toggleOverlay()` function from `window.ts` and its associated tests, and fix the related spec drift in `architecture.md`.

## Decision Rationale

**Remove entirely** (not deprecate) because:
- No production code imports `toggleOverlay` — both hotkey and tray use `requestToggle()` from session.ts
- It bypasses the session lifecycle, making it a footgun if anyone accidentally uses it
- Deprecation adds noise for a function with zero callers
- `showOverlay()` and `hideOverlay()` remain available as low-level primitives for the session manager

## Steps

### 1. Remove `toggleOverlay()` from `src/main/window.ts`

Delete the exported function at lines 248-254:

```ts
export function toggleOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
    hideOverlay();
  } else {
    showOverlay();
  }
}
```

### 2. Remove `toggleOverlay` tests from `src/main/window-visibility.test.ts`

- Remove `toggleOverlay` from the import statement on line 144
- Delete the `describe('toggleOverlay', ...)` block at lines 212-227

### 3. Update `spec/architecture.md` line 72

Change the Hotkey Manager description from:
> Registers the global hotkey via `globalShortcut`, sends show/hide commands to Window Manager

To:
> Registers the global hotkey via `globalShortcut`, triggers session toggle via Session Manager

This corrects spec drift introduced in T30.

## Risks / Open Questions

- **Mock variable naming in test files**: `hotkey.test.ts` and `tray.test.ts` use `mockToggleOverlay` as a variable name for their `requestToggle` mock. This is mildly misleading after removing the real function, but it's scoped to test internals and doesn't affect correctness. Renaming mock variables is out of scope for this task.
