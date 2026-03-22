# Discovered Tasks

1. **API: Update spec/api.md to match current Soniox protocol**
   - Description: `spec/api.md` has stale endpoint URL (`wss://stt.soniox.com/transcribe` vs actual `wss://stt-rt.soniox.com/transcribe-websocket`), stale field names (`audio_final_proc_ms` vs `final_audio_proc_ms`), stale audio format (`pcm_s16le` vs `s16le`), and incorrect final-token semantics (says finals appear once, but implementation deduplicates repeated finals via watermark).
   - Why discovered: The plan review (codex) cross-referenced `spec/api.md` against the implementation in `soniox.ts` and found multiple inconsistencies.
