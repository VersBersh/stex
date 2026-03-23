# Voice input: avoid premature scrolling of input box on first transcription

## Summary

When the first text is returned from Soniox during voice input, the input box scrolls slightly and hides existing text. Scrolling should only occur when it is actually necessary (i.e., when content overflows the visible area), not prematurely on the first transcription result.

## Acceptance criteria

- When voice input begins producing ghost text, the input box does not scroll unless the content actually exceeds the visible area.
- Existing text remains visible and is not hidden by unnecessary scroll adjustments.
- When content does eventually overflow, scrolling behaves normally to keep the active insertion point visible.

## References

- Feedback: `.mound/feedback/20260323-150759-651-ef1b.md` (item 2)
