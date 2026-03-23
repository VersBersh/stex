# Implementation Notes

## Files Modified

- `spec/models.md` — Added `"disconnected"` and `"reconnecting"` to the `SessionState.status` union type (line 95), matching `src/shared/types.ts:38`.

## Deviations from Plan

None.

## New Tasks / Follow-up Work

1. **Runtime `disconnected` state gap**: `handleDisconnect()` in `soniox-lifecycle.ts` transitions directly to `reconnecting` or `error`, never to `disconnected`. The `disconnected` value exists in the type union, UI status text map, and session dismiss handler, but is never emitted. Either implement the missing transition or remove the dead value.

2. **Reconnect flow spec-implementation inconsistency**: `spec/api.md:124` describes "Disconnected" → "Reconnecting..." → "Reconnected" flow, but the implementation goes `reconnecting` → `paused` (with error cleared). The spec and implementation should be reconciled.
