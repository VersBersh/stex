# Investigate: Finalize delay after Ctrl+Shift+Space

## Summary
After transcribing and then pressing Ctrl+Shift+Space to stop, there is a noticeable delay before the transcription is finalized, even though the tokens visually appear to already be in their final form. This suggests there may be redundant processing or unnecessary waiting happening during the finalization step.

## Acceptance criteria
- Investigate the finalization flow triggered by Ctrl+Shift+Space
- Identify whether there is redundant work being done (e.g., waiting for final tokens that have already arrived, unnecessary server round-trips, or duplicate processing)
- Document findings with specific code paths and timing measurements
- If redundancy is found, propose or implement a fix to reduce the finalization delay
- If no redundancy is found, document why the delay occurs and whether it can be reduced

## References
- Feedback: `.mound/feedback/20260323-121442-061-5501.md` (item 5)
