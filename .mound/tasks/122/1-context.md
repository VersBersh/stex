# Context

## Relevant Files

- `spec/api.md` — Source of truth for the Soniox WebSocket protocol, including the Manual Finalization section (lines 248-257) which documents the finalization timeout and graceful degradation behavior.
- `spec/features/inline-editing.md` — Feature spec for inline editing; "Pause Semantics" section (line 85) references waiting for `finished: true` without mentioning timeout.
- `spec/features/realtime-transcription.md` — Feature spec for real-time transcription; "Ending a Session" section (lines 31-32) references waiting for `finished: true` without mentioning timeout.
- `spec/features/text-output.md` — Feature spec for text output; "Clipboard" section (line 13) references waiting for `finished: true` without mentioning timeout.
- `src/main/session.ts` — Implementation: defines `FINALIZATION_TIMEOUT_MS = 5000` and `waitForFinalization()` which proceeds after timeout with a warning.

## Architecture

The Soniox WebSocket protocol uses a finalization handshake: the client sends an empty binary frame to signal end-of-stream, and the server responds with `finished: true` after finalizing remaining tokens. The client waits for this response but applies a 5-second timeout to prevent hangs — if the server doesn't respond in time, the client proceeds anyway (graceful degradation).

This behavior is documented in `spec/api.md`'s Manual Finalization section. Three feature specs describe user-facing flows that trigger finalization (pause, stop/hide, clipboard copy) and reference waiting for `finished: true`, but none mention the timeout or what happens if it expires. This creates a minor inconsistency.
