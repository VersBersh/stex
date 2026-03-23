# Context

## Relevant Files

| File | Role |
|------|------|
| `spec/decisions.md` | Architecture decision log; contains Decision 7 (manual WebSocket over SDK) which this task re-evaluates |
| `src/main/soniox.ts` | Current manual WebSocket client (~156 lines) for Soniox real-time STT |
| `src/main/soniox-lifecycle.ts` | Connection lifecycle management, reconnection logic; consumes `classifyDisconnect()` with raw close codes |
| `src/main/error-classification.ts` | Classifies WebSocket close codes (1000, 1001, 1006, 1008, 1011) into reconnectable/terminal errors |
| `src/main/error-classification.test.ts` | Tests for error classification |
| `src/main/soniox.test.ts` | Unit tests for SonioxClient (21 tests) |
| `src/main/soniox-lifecycle.test.ts` | Tests for lifecycle/reconnection logic |
| `.mound/tasks/91/3-plan.md` | Original task 91 plan documenting the SDK evaluation |
| `.mound/tasks/91/4-impl-notes.md` | Task 91 implementation notes including discovered follow-up work |

## Architecture

The Soniox integration is a three-layer subsystem in the Electron main process:

1. **`SonioxClient`** (`soniox.ts`) — raw WebSocket client that connects to `wss://stt-rt.soniox.com/transcribe-websocket`, sends JSON config on open, streams PCM audio as binary frames, and parses JSON responses into final/non-final token callbacks. Uses a `lastFinalProcMs` watermark to deduplicate final tokens.

2. **`soniox-lifecycle.ts`** — orchestrates connect/disconnect/reconnect lifecycle. On disconnect, delegates to `classifyDisconnect()` which examines raw WebSocket close codes and reason strings to determine if reconnection should be attempted.

3. **`error-classification.ts`** — maps WebSocket close codes to error types. This is the primary blocker for SDK migration: it depends on transport-level close codes that the SDK would abstract away.

Key constraints:
- Error classification relies on raw WebSocket close codes (RFC 6455)
- Token deduplication depends on `final_audio_proc_ms` field from raw responses
- Current implementation is small (~156 lines), well-tested (21 tests), and stable
