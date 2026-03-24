# SPEC: Make stop/hide finalization conditional in realtime-transcription and text-output specs

## Summary
`spec/features/realtime-transcription.md` and `spec/features/text-output.md` describe the stop/hide finalization flow as unconditional (always sends empty frame, always waits), while `spec/api.md` documents it as conditional ("only sent if the WebSocket is connected and there are pending non-final tokens"). These feature specs should be updated to reflect the conditional behavior documented in the API spec.

## Acceptance criteria
- `spec/features/realtime-transcription.md` stop/finalization section reflects conditional behavior: empty frame and wait only occur when the WebSocket is connected and there are pending non-final tokens.
- `spec/features/text-output.md` hide/finalization section reflects the same conditional behavior.
- Language is consistent with `spec/api.md` description of the finalization flow.

## References
- `spec/features/realtime-transcription.md`
- `spec/features/text-output.md`
- `spec/api.md`
- Discovered during task 122 (SPEC: Add finalization timeout details to feature specs)
