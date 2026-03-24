# Spec Updates Required

## 1. `spec/features/realtime-transcription.md` — Ending a Session

The numbered steps 2-3 (send empty frame, wait for `finished: true`) are written as unconditional. They should be wrapped in a condition: "if the WebSocket is connected and there are pending non-final tokens". This matches `api.md` line 254.

## 2. `spec/features/text-output.md` — Clipboard (Primary)

Same issue: steps 2-3 are unconditional. Apply the same conditional wrapper to match `api.md`.

No new spec content is needed.
