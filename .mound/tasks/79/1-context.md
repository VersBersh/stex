# Context — Task 79

## Relevant Files

| File | Role |
|------|------|
| `src/main/error-classification.ts` | Contains `classifyDisconnect(code, reason)` and `classifyAudioError(err)`. Target of this task. |
| `src/main/error-classification.test.ts` | Tests for both classification functions. Must be updated. |
| `src/main/session.ts` | Calls `classifyDisconnect` from `handleDisconnect(code, reason)` at line 176. Consumer of the function. |
| `src/main/soniox.ts` | `SonioxClient` — wraps the WebSocket connection. Fires `onDisconnected(code, reason)` from the WebSocket `close` event (line 64-66), providing the standard RFC 6455 close code. |
| `src/shared/types.ts` | Defines `ErrorInfo` type used as the return value's `error` field. `ErrorInfo.type` is a union: `'api-key' | 'rate-limit' | 'mic-denied' | 'mic-unavailable' | 'network' | 'no-api-key' | 'unknown'`. |

## Architecture

The error classification subsystem was extracted from `session.ts` in task 68. It provides pure functions that map error signals to structured `ErrorInfo` objects with reconnectability metadata.

**Flow:** `SonioxClient` WebSocket `close` event → `onDisconnected(code, reason)` callback → `handleDisconnect(code, reason)` in `session.ts` → `classifyDisconnect(code, reason)` in `error-classification.ts` → returns `{ reconnectable: boolean; error: ErrorInfo }`.

**Current problem:** `classifyDisconnect` accepts `code` but ignores it, classifying entirely on the `reason` string. WebSocket close codes have standardized semantics (RFC 6455) and are more reliable than provider-specific reason text.

**Key close codes relevant to this application:**
- `1000` — Normal closure (clean disconnect, not reconnectable)
- `1001` — Going away (server shutting down, reconnectable)
- `1006` — Abnormal closure (no close frame received — network issue, reconnectable)
- `1008` — Policy violation (often used for auth failures, not reconnectable)
- `1011` — Internal server error (server-side issue, reconnectable)
- `4000-4999` — Application-defined codes (Soniox-specific — need reason text fallback)

**Constraint:** The `ErrorInfo.type` union is fixed and shared across the app. No new error types should be added for this task.
