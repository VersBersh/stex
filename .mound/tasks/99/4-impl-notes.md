# Implementation Notes

## Files modified

- `src/main/soniox.ts` — added `isEndpointMarker()` helper function and a `contentTokens` filtering step in `handleMessage()` to strip `<end>` protocol markers before final/non-final separation
- `src/main/soniox.test.ts` — added `describe('endpoint marker filtering')` block with 4 unit tests
- `spec/api.md` — updated Client-Side Processing section to document the protocol marker filtering step and updated pseudocode

## Deviations from plan

- Added `onNonFinalTokens([])` emission when all tokens in a response are protocol markers. This addresses a design review concern: without it, ghost text would not be cleared if a response contained only `<end>` tokens (since `onFinalTokens` would no longer fire to trigger `handleFinalTokens()` in GhostTextPlugin). Updated the corresponding test to expect `onNonFinalTokens([])` instead of no callback.

## New tasks or follow-up work

- Reconcile stale details in `spec/api.md`: endpoint URL (`wss://stt.soniox.com/transcribe` vs actual `wss://stt-rt.soniox.com/transcribe-websocket`), response field names (`audio_final_proc_ms`/`audio_total_proc_ms` vs code's `final_audio_proc_ms`/`total_audio_proc_ms`), and missing `enable_endpoint_detection` in config message example.
