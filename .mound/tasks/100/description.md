# Bug: Cursor does not follow end of transcription line

## Summary
During or after transcription, the text cursor does not automatically scroll or follow the end of the current line of transcribed text. This makes it difficult for users to see what is being transcribed in real-time, especially for longer utterances that extend beyond the visible area.

## Acceptance criteria
- During active transcription, the cursor/viewport automatically follows the end of the transcribed text
- The user can see the most recently transcribed content without manually scrolling
- This does not interfere with the user's ability to manually scroll or position their cursor elsewhere if desired

## References
- Feedback: `.mound/feedback/20260323-121442-061-5501.md` (item 4)
