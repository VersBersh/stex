# Implementation Notes

## Files modified
- `spec/api.md` — Complete rewrite to match current Soniox protocol implementation

## Changes summary
1. Fixed endpoint URL: `wss://stt.soniox.com/transcribe` → `wss://stt-rt.soniox.com/transcribe-websocket`
2. Fixed model name: `stt-rt-preview` → `stt-rt-v4`, noted as configurable
3. Added `enable_endpoint_detection: true` to config message
4. Fixed response field names: `audio_final_proc_ms` → `final_audio_proc_ms`, `audio_total_proc_ms` → `total_audio_proc_ms`
5. Added missing response fields: `finished`, `error_code`, `error_message`
6. Added missing token field: `speaker` (optional)
7. Added structured field tables for response and token formats
8. Added error response example
9. Rewrote token lifecycle rules to accurately reflect deduplication semantics (final tokens may be re-sent, `final_audio_proc_ms` is a watermark)
10. Added endpoint marker filtering as an explicit rule
11. Updated client-side pseudocode to match actual implementation logic
12. Replaced simple error table with structured error handling sections (server errors, disconnect classification, reconnect behavior, audio errors)
13. Updated manual finalization section with conditional hide behavior, finalization timeout, configurable clipboard, and quick dismiss

## Deviations from plan
- None. All 7 plan steps were implemented as described.

## New tasks or follow-up work
- Review item 4 (Minor) noted that `spec/features/inline-editing.md`, `spec/features/realtime-transcription.md`, and `spec/features/text-output.md` reference `finished: true` without mentioning timeout behavior. These could be updated for consistency but are out of scope for this task.
