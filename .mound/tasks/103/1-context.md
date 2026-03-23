# Context

## Relevant Files

- `spec/api.md` — The spec file to update. Documents the Soniox WebSocket API protocol.
- `src/main/soniox.ts` — Core WebSocket client: endpoint URL, config message, response parsing, token processing.
- `src/main/soniox-lifecycle.ts` — Session lifecycle orchestration: connect, disconnect, reconnect, finalize, audio capture.
- `src/main/session.ts` — High-level session state machine: start/pause/resume/stop, finalization timeout.
- `src/main/error-classification.ts` — Classifies WebSocket disconnect codes and audio errors into error types.
- `src/main/reconnect-policy.ts` — Exponential backoff delay calculation.
- `src/main/settings.ts` — Default settings including `sonioxModel: 'stt-rt-v4'`.
- `src/shared/types.ts` — Shared TypeScript interfaces: `SonioxToken`, `SonioxResponse`, `ErrorInfo`, `SessionState`, `AppSettings`.

## Architecture

The Soniox integration is a layered subsystem:

1. **SonioxClient** (`soniox.ts`) — Low-level WebSocket wrapper. Opens connection, sends config JSON on open, sends audio chunks as binary frames, parses JSON responses, filters endpoint markers, deduplicates final tokens via a `lastFinalProcMs` watermark, and emits typed callbacks.

2. **Lifecycle layer** (`soniox-lifecycle.ts`) — Manages the connection lifecycle: initial connect, disconnect handling with reconnectable/non-reconnectable classification, reconnect scheduling via exponential backoff, and audio capture start/stop coordination.

3. **Session manager** (`session.ts`) — Top-level state machine (`idle → connecting → recording ↔ paused → finalizing → idle`). Coordinates pause/resume/stop, triggers finalization (empty binary frame + wait for `finished: true` with 5s timeout), and manages IPC to the renderer.

4. **Error classification** (`error-classification.ts`) — Maps WebSocket close codes and reason strings to typed errors (`api-key`, `rate-limit`, `network`, `mic-denied`, etc.) and determines reconnectability.
