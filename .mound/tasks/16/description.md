# T16: Text Output & Finalization Flow

## Summary

Implement the text output flow: when the window hides, finalize pending speech, copy text to clipboard, and handle the onShow fresh/append behavior.

## Scope

- **On hide (via global hotkey)**:
  1. Session Manager enters `finalizing` state
  2. Mic stops, empty frame sent to Soniox
  3. Wait for `finished: true` response
  4. Final tokens committed to editor
  5. Full document text (committed only, no ghost text) copied to clipboard as plain text
  6. If editor is empty, skip clipboard (don't overwrite user's existing clipboard)
  7. Window hides
  8. Brief tray icon flash to confirm copy
- **On hide (via Escape)**: hide immediately without finalization or clipboard copy
- **On show**:
  - `onShow: "fresh"` (default): clear editor, start blank
  - `onShow: "append"`: keep previous text, new transcription appends after it
- **Manual copy**: Copy button in status bar and Ctrl+C work at any time

## Acceptance Criteria

- Text is on the clipboard after finalization completes (hotkey hide)
- Clipboard contains plain text only (no formatting)
- Empty editor does not overwrite the clipboard
- Escape hides without clipboard copy
- `onShow` fresh/append behavior works correctly
- Tray icon flashes on successful copy

## References

- `spec/features/text-output.md` — full text output specification
- `spec/hotkeys.md` — Escape vs global hotkey hide behavior
- `spec/features/system-tray.md` — onShow behavior
