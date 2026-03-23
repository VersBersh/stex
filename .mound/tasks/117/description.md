# Investigate Soniox API support for providing prior context to improve transcription

## Summary

Investigate whether the Soniox speech-to-text API supports providing context (e.g., the text preceding the cursor position) so that transcription results are more accurate as a "completion" of existing text. If the API supports this, implement it by passing the relevant preceding text as context when starting or during a voice input session.

## Acceptance criteria

- Research Soniox API documentation to determine if a context/prompt parameter is available for guiding transcription.
- Document findings (supported or not, relevant API parameters, any limitations).
- If supported: implement passing the preceding text (e.g., the text before the cursor in the editor) as context to the Soniox API when initiating or during a voice transcription session.
- If not supported: document this finding in the task and close as not actionable.

## References

- Feedback: `.mound/feedback/20260323-150759-651-ef1b.md` (item 3)
- Soniox API documentation (external)
