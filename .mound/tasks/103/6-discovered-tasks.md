# Discovered Tasks

## 1. SPEC: Update feature specs for finalization timeout consistency
- **Summary**: `SPEC: Add finalization timeout details to feature specs`
- **Description**: `spec/features/inline-editing.md`, `spec/features/realtime-transcription.md`, and `spec/features/text-output.md` reference waiting for `finished: true` without mentioning the 5-second timeout or graceful degradation behavior that is documented in the updated `spec/api.md`.
- **Why discovered**: Plan review flagged that updating `api.md` with timeout details creates a minor inconsistency with other feature specs that reference the same protocol behavior.
