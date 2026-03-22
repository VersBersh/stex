# Spec Updates for Task 30

## Spec changes required

### `spec/architecture.md` — IPC Messages table (line 128)

**Change**: Update the `window:hide` IPC description from "Hide the overlay window (title bar button or Escape key)" to "Request overlay dismiss — routes through Session Manager for finalization before hiding (title bar button or Escape key)".

**Why**: After this task, `window:hide` no longer directly hides the window. It triggers session finalization (audio stop, clipboard copy) via the Session Manager's `closeRequestHandler` callback before hiding. The spec should reflect this routing.

## New spec content

None.
