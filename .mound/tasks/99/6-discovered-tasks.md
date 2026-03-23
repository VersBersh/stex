# Discovered Tasks

## 1. SPEC: Reconcile stale details in spec/api.md

**Description:** The `spec/api.md` file has several details that have drifted from the actual implementation:
- Endpoint URL: spec says `wss://stt.soniox.com/transcribe`, code uses `wss://stt-rt.soniox.com/transcribe-websocket`
- Response field names: spec says `audio_final_proc_ms`/`audio_total_proc_ms`, code uses `final_audio_proc_ms`/`total_audio_proc_ms`
- Config message example: missing `enable_endpoint_detection` field that is sent in the actual implementation

**Why discovered:** The plan review and design review both flagged that the spec file being edited already had stale details that don't match the codebase. These were pre-existing and outside the scope of the bug fix.
