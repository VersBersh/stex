# Implementation Notes — Task 150

Trivial: no

## Files modified

- **`src/main/soniox-lifecycle.ts`** — Added `connectionBaseMs` state variable, exported `applyTimestampOffset()` pure function, applied offset in both `connectSoniox()` and `attemptReconnect()` token callbacks, reset `connectionBaseMs` in `resetLifecycle()`
- **`src/main/soniox-lifecycle.test.ts`** — Added 8 tests: 5 for `applyTimestampOffset` pure function, 3 for lifecycle integration (initial connection and reconnect with offset 0)
- **`spec/models.md`** — Updated `SonioxToken` description to clarify connection-relative vs session-relative timestamps

## Deviations from plan

1. **No `getConnectionBaseMs()` export**: The plan review flagged this as unnecessary API widening for task 150. Kept `connectionBaseMs` fully internal — only readable via the exported `applyTimestampOffset` pure function for testing. Future tasks (152) can introduce a getter/setter when they need it.

2. **No `setConnectionBaseMs()` export**: Same rationale — the plan review correctly noted a naked setter would allow corrupting timestamps while a connection is live. Task 152 should introduce this through a connection-creation API.

3. **Captured `connectionBaseMs` at connection-creation time**: Design review flagged temporal coupling with reading module-global `connectionBaseMs` lazily in callbacks. Fixed by capturing `const baseMs = connectionBaseMs` at connection-creation time in both `connectSoniox()` and `attemptReconnect()`, then closing over the immutable `baseMs` in callbacks. This makes the offset per-connection immutable.

## New tasks or follow-up work

None discovered.
