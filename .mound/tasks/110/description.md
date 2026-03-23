# SESS: Reconcile `disconnected` state — implement or remove

## Summary

The `disconnected` value exists in the `SessionState.status` type union, the UI status text map, and the session dismiss handler, but is never emitted at runtime. `handleDisconnect()` transitions directly to `reconnecting` or `error`, so no runtime path produces the `disconnected` status. Either implement the missing transition so `disconnected` is actually used, or remove the dead value from the type union, UI map, and handler.

## Acceptance criteria

- Audit all references to the `disconnected` status value across types, UI text maps, and handlers.
- Either:
  - **Implement**: Add a runtime transition that emits `disconnected` (e.g., a brief state between WebSocket close and reconnect attempt), and verify the UI renders it correctly.
  - **Remove**: Delete `disconnected` from the `SessionState.status` union, UI status text map, and dismiss handler. Ensure no compile errors or dead branches remain.
- Whichever path is chosen, confirm with a passing build and existing tests.

## References

- Discovered in task 104 plan review: no runtime path produces `disconnected` status
- `SessionState.status` type definition
- `handleDisconnect()` in soniox-lifecycle.ts
