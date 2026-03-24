# Plan

## Goal

Make the stop/hide finalization flow conditional in `realtime-transcription.md` and `text-output.md` to match the behavior documented in `api.md`.

## Steps

1. **Edit `spec/features/realtime-transcription.md`** — In the "Ending a Session" section, restructure steps 2-3 to be conditional on the WebSocket being connected and there being pending non-final tokens. Keep step 1 (mic capture stops) and steps 4-6 unconditional.

2. **Edit `spec/features/text-output.md`** — In the "Clipboard (Primary)" section, restructure steps 2-3 with the same conditional. Keep step 1 (mic capture stops) and steps 4-5 unconditional.

## Risks / Open Questions

None — the conditional behavior is clearly documented in `api.md` and the changes are straightforward text edits.
