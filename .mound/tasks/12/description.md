# T12: Ghost Text Plugin

## Summary

Implement a Lexical plugin that renders non-final (provisional) tokens from Soniox as styled, read-only "ghost text" at the document tail.

## Scope

- Create `src/renderer/overlay/editor/GhostTextPlugin.tsx`
- Listen for `tokens:nonfinal` IPC messages
- Render non-final tokens at the end of the document with distinct styling:
  - Muted color (`#999` light theme, `#666` dark theme)
  - Italic
  - Not selectable, not editable
- Replace ghost text entirely on each update (no accumulation)
- Remove ghost text when:
  - Non-final tokens list is empty
  - Session is paused or stopped
- **Cursor boundary rules**:
  - Arrow Right at end of committed text: cursor stays, does not enter ghost text
  - Mouse click within ghost text: cursor snaps to end of committed text
  - Mouse drag selection into ghost text: selection stops at end of committed text
  - Backspace at boundary: deletes last committed character (normal behavior)
- Ghost text updates should not cause layout shift or flickering

## Acceptance Criteria

- Non-final tokens display as muted italic text at document tail
- Ghost text updates in place without flicker
- Ghost text is not selectable or editable
- Cursor cannot enter the ghost text region
- Ghost text is removed on pause/stop

## References

- `spec/ui.md` — ghost text styling and cursor boundary behavior
- `spec/models.md` — `GhostText` interface
- `spec/architecture.md` — Ghost Text Plugin responsibilities
- `spec/features/realtime-transcription.md` — token flow
