# Context

## Relevant Files

- `src/shared/types.ts` — Defines `SessionState.status` union type including `disconnected` (line 38)
- `src/main/soniox-lifecycle.ts` — Contains `handleDisconnect()` (line 65) which transitions to `reconnecting` or `error`, never `disconnected`
- `src/main/session.ts` — Session manager; `onDismissError` handler (line 203) checks for `status === 'disconnected'`
- `src/renderer/overlay/components/StatusBar.tsx` — `STATUS_TEXT` map (line 10) includes `disconnected: 'Disconnected'`
- `src/renderer/overlay/OverlayContext.tsx` — Comment at line 96 mentions `disconnected` as a no-op state for pause/resume
- `src/main/session-reconnect.test.ts` — Test at line 476 named "pause is a no-op during disconnected state" (tests reconnecting state, not disconnected)
- `spec/models.md` — Spec definition of `SessionState.status` union includes `disconnected` (line 95)
- `spec/architecture.md` — IPC message table lists `disconnected` in `session:status` values (line 124)
- `src/main/error-classification.ts` — `classifyDisconnect()` returns `{ reconnectable, error }`, no `disconnected` status involved

## Architecture

The session subsystem manages the lifecycle of a transcription session through a status state machine:

`idle` → `connecting` → `recording` ⇌ `paused` → `finalizing` → `idle`

Error/reconnect path: When the WebSocket disconnects, `handleDisconnect()` in `soniox-lifecycle.ts` immediately classifies the disconnect via `classifyDisconnect()`. If reconnectable, it calls `scheduleReconnect()` which emits `reconnecting` status. If not reconnectable, it emits `error` status. There is no intermediate `disconnected` state.

The `disconnected` value was added to the type union alongside `reconnecting` as part of the reconnection feature, but was never wired to any runtime transition. It exists in:
1. The TypeScript type union (compile-time only)
2. The UI status text map (never rendered)
3. The dismiss error handler condition (dead branch)
4. A comment and a misleadingly-named test

No runtime code path produces the `disconnected` status value.
