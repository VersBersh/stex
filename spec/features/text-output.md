# Feature: Text Output

## Summary

After a transcription session, the corrected text needs to go somewhere useful — clipboard, file, or direct paste into another application.

## Behavior

### Clipboard (Primary)

- When the window is hidden via hotkey, the app enters a brief **finalizing** state:
  1. Mic capture stops
  2. An empty frame is sent to Soniox to finalize pending tokens
  3. The app waits for the `finished: true` response, subject to a 5-second timeout (see [api.md — Manual Finalization](../api.md#manual-finalization)). If the timeout expires, the app proceeds anyway.
  4. The full document text (committed text only) is copied to the system clipboard
  5. The window hides
- If the editor is empty, **nothing is copied** to the clipboard (to avoid overwriting the user's existing clipboard contents)
- User can then paste into any application
- A brief **tray icon flash** confirms text was copied (an in-window toast would not be visible since the window is hiding)

### Manual Copy

- `Ctrl+C` copies the current selection, or all text if nothing is selected
- `Ctrl+A` selects all text in the editor (committed + any finalized ghost text)

### Clear on New Session

Controlled by the `onShow` setting in `AppSettings`:

- **`"fresh"`** (default): Clear the editor when the window is shown, start with a blank document
- **`"append"`**: Keep previous text when the window is shown, new transcription appends after it

### Future Considerations

- Direct paste into the previously focused application (simulate `Ctrl+V` after hiding)
- Save to file
- Integration with specific apps

## Acceptance Criteria

- Text is on the clipboard after finalization completes
- Clipboard contains plain text only (no formatting artifacts)
- Empty editor does not overwrite the clipboard
- User can manually copy any selection at any time
