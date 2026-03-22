# Spec Updates — Task 68: Decompose session.ts

No spec updates required.

This is a pure internal refactor. The existing specs (`spec/architecture.md`, `spec/features/realtime-transcription.md`, etc.) describe Session Manager behavior and IPC contracts — none of these change. The `ErrorInfo` type in `shared/types.ts` is unchanged. The new modules (`reconnect-policy.ts`, `error-classification.ts`) are internal implementation details of the Session Manager; they are imported by `session.ts` at runtime and have their own unit tests but do not alter any public API or IPC contract.
