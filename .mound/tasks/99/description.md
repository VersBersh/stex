# Bug: Remove spurious `<end>` tag after first transcription

## Summary
After the first transcription completes, an `<end>` tag is visibly rendered in the transcription output. This is likely a control/protocol marker from the transcription service that is leaking into the displayed text instead of being handled internally.

## Acceptance criteria
- No `<end>` tag (or similar protocol markers) appears in the transcription output visible to the user
- The fix handles the tag at the point where transcription results are processed/displayed, not by stripping it as a post-processing hack (unless that is the only viable approach)
- Verified by running a transcription session and confirming no spurious tags appear

## References
- Feedback: `.mound/feedback/20260323-121442-061-5501.md` (item 3)
