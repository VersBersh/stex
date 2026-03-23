# Plan

## Goal

Add `disconnected` and `reconnecting` values to the `SessionState.status` union in `spec/models.md` to match the authoritative type definition in `src/shared/types.ts`.

## Steps

1. **Edit `spec/models.md` line 95** — Change the `status` field type from:
   ```
   status: "idle" | "connecting" | "recording" | "paused" | "finalizing" | "error";
   ```
   to:
   ```
   status: "idle" | "connecting" | "recording" | "paused" | "finalizing" | "error" | "disconnected" | "reconnecting";
   ```
   This exactly matches the union in `src/shared/types.ts:38` and aligns with `spec/architecture.md:124` which already enumerates these values.

## Risks / Open Questions

- **`disconnected` state not emitted at runtime**: The plan review identified that `handleDisconnect()` in `soniox-lifecycle.ts` transitions directly to `reconnecting` (reconnectable) or `error` (non-reconnectable), never explicitly to `disconnected`. However, `disconnected` is part of the authoritative type contract in `types.ts`, is referenced in `spec/api.md:124` (error handling table), `spec/architecture.md:124` (IPC channels), the UI status bar text map, and the session dismiss handler. This task's scope is aligning `models.md` with the type contract — the runtime gap should be addressed separately.
- **Broader spec-implementation inconsistency**: `spec/api.md:124` describes a "Disconnected" → "Reconnecting..." → "Reconnected" flow, but the implementation goes `reconnecting` → `paused`. This is out of scope for this task and should be filed as a separate reconciliation task.
