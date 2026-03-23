# Discovered Tasks

1. **SESS: Reconcile `disconnected` state — implement or remove**
   - The `disconnected` value exists in `SessionState.status` type union, UI status text map, and session dismiss handler, but is never emitted at runtime. `handleDisconnect()` transitions directly to `reconnecting` or `error`. Either implement the missing transition or remove the dead value.
   - Discovered when: plan review identified that no runtime path produces the `disconnected` status.

2. **SPEC: Reconcile reconnect flow between spec/api.md and implementation**
   - `spec/api.md:124` describes a "Disconnected" → "Reconnecting..." → "Reconnected" flow, but the implementation goes `reconnecting` → `paused` (with error cleared on successful reconnect). The spec and implementation should be aligned.
   - Discovered when: plan review cross-referenced spec/api.md error handling table with soniox-lifecycle.ts reconnect flow.
