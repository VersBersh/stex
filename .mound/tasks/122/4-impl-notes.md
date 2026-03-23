# Implementation Notes

## Files modified

- `spec/api.md` — Made the 5-second timeout duration explicit in the Manual Finalization section (was "a timeout", now "5-second timeout" with graceful degradation phrasing).
- `spec/features/inline-editing.md` — Updated Pause Semantics step 3 to reference the 5-second timeout and api.md. Notes that WebSocket remains open on pause, so late tokens may still arrive.
- `spec/features/realtime-transcription.md` — Updated Ending a Session step 3 to reference the 5-second timeout and api.md.
- `spec/features/text-output.md` — Updated Clipboard step 3 to reference the 5-second timeout and api.md.

## Deviations from plan

None.

## New tasks or follow-up work

- The stop/hide flow in `spec/features/realtime-transcription.md` and `spec/features/text-output.md` describes finalization as unconditional (always sends empty frame, always waits), while `spec/api.md` documents it as conditional ("only sent if the WebSocket is connected and there are pending non-final tokens"). This is a pre-existing inconsistency noted by the plan review, outside the scope of task 122.
