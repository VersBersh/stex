# Discovered Tasks

## 1. SPEC: Align stop/hide finalization conditionality in feature specs
- **Summary**: `SPEC: Make stop/hide finalization conditional in realtime-transcription and text-output specs`
- **Description**: `spec/features/realtime-transcription.md` and `spec/features/text-output.md` describe the stop/hide finalization flow as unconditional (always sends empty frame, always waits), while `spec/api.md` documents it as conditional ("only sent if the WebSocket is connected and there are pending non-final tokens"). These feature specs should be updated to reflect the conditional behavior.
- **Why discovered**: Plan review for task 122 flagged this as a pre-existing inconsistency between feature specs and api.md. It was out of scope for this task (which focused on timeout details only).
