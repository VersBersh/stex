# Voice input: cursor should track end of ghost text by default

## Summary

During voice input (speech-to-text), the cursor does not move forward as ghost text is inserted. The expected behavior is that the cursor tracks the end of the ghost text by default, until the user clicks elsewhere to reposition the cursor.

## Acceptance criteria

- While voice input is active and the user has not clicked to reposition the cursor, the cursor position advances to track the end of the ghost text as new transcription results arrive.
- If the user clicks elsewhere in the editor during voice input, the cursor stays at the clicked position and no longer auto-tracks the ghost text.
- Cursor tracking resumes at the end of ghost text on the next voice input session.

## References

- Feedback: `.mound/feedback/20260323-150759-651-ef1b.md` (item 1)
