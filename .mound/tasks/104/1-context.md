# Context

## Relevant Files

- `spec/models.md` — Spec file defining all shared data models including `SessionState`. Currently missing `disconnected` and `reconnecting` status values.
- `src/shared/types.ts` — Authoritative TypeScript type definitions. `SessionState.status` includes all 8 values: `idle`, `connecting`, `recording`, `paused`, `finalizing`, `error`, `disconnected`, `reconnecting`.
- `src/main/soniox-lifecycle.ts` — Implements reconnection logic. `scheduleReconnect()` sets status to `'reconnecting'`; `handleDisconnect()` classifies disconnects as reconnectable or not.
- `src/main/session.ts` — Session manager. `onStatusChange` callback propagates status changes from lifecycle module. `onDismissError` handler checks for `'disconnected'` status.

## Architecture

`SessionState.status` is a union type that represents all possible states of a transcription session. The lifecycle module (`soniox-lifecycle.ts`) manages WebSocket connections and emits status changes via callbacks. When a WebSocket disconnect occurs:

1. If reconnectable (e.g., network error): status transitions to `'reconnecting'`, and the module schedules automatic reconnection with exponential backoff.
2. If not reconnectable (e.g., invalid API key): status transitions to `'error'`.

The `'disconnected'` status represents a state where the WebSocket has been lost and the user can dismiss the error to return to `'idle'`. Both `'disconnected'` and `'reconnecting'` were added as part of the reconnection feature but the spec was not updated.
