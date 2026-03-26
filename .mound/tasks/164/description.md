# SPEC: Update models.md audioInputDevice type from PortAudio to getUserMedia architecture

## Summary
`spec/models.md` still types `audioInputDevice` as "PortAudio device name", but task 142 replaced naudiodon/PortAudio audio capture with Chromium's `getUserMedia` API. The spec should be updated to reflect the current getUserMedia-based device selection model.

This is a spec-only change discovered during task 157 (README naudiodon cleanup), where it was noted that spec files still reference the old audio architecture.

## Acceptance criteria
- `spec/models.md` no longer references PortAudio for `audioInputDevice`
- The `audioInputDevice` type/description reflects the current getUserMedia-based device selection (e.g., MediaDevices device ID or label)
- No other stale PortAudio references remain in `spec/models.md`

## References
- `spec/models.md` — the file to update
- Task 142 — replaced naudiodon/PortAudio with getUserMedia
- Task 162 — already updated `spec/decisions.md` D4/D5 for the same migration
- Task 157 — where this was discovered
