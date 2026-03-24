# Context

## Relevant Files

- `spec/features/realtime-transcription.md` — Feature spec for real-time transcription; "Ending a Session" section describes finalization as unconditional
- `spec/features/text-output.md` — Feature spec for text output; "Clipboard (Primary)" section describes finalization as unconditional
- `spec/api.md` — API spec; "Manual Finalization" section documents the conditional stop/hide behavior (lines 248-256)

## Architecture

These three spec files describe the same finalization flow from different perspectives. `api.md` is the authoritative source for the finalization protocol and correctly documents stop/hide finalization as conditional ("only sent if the WebSocket is connected and there are pending non-final tokens"). The two feature specs currently describe the same flow as unconditional (always send empty frame, always wait), which is inconsistent with `api.md`.
