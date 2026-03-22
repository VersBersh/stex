# Spec Updates — Task 79

No spec updates required.

The `spec/` directory exists and contains `spec/api.md`, `spec/architecture.md`, and `spec/features/realtime-transcription.md` which describe disconnect handling. The existing specs say:
- `spec/api.md:124`: "WebSocket disconnect → Auto-reconnect with exponential backoff"
- `spec/features/realtime-transcription.md:36`: "Network interruption: Stop mic capture, auto-reconnect with exponential backoff"

The revised plan keeps all standard close codes (1000, 1001, 1006, 1011) reconnectable, and only classifies as non-reconnectable when the reason text explicitly indicates auth or rate-limit errors. This is consistent with existing spec intent — no spec changes are needed.

The change is an internal refactor of the classification logic that preserves the same external behavior while making the implementation more robust against reason text changes.
