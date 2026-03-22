# Implementation Notes — Task 68

## Files created or modified

- `src/main/error-classification.ts` — **New**. Contains `classifyAudioError` and `classifyDisconnect`, extracted verbatim from session.ts.
- `src/main/reconnect-policy.ts` — **New**. Contains `getReconnectDelay` with private constants (1000ms initial, 2x multiplier, 30s cap).
- `src/main/error-classification.test.ts` — **New**. Unit tests for both classification functions.
- `src/main/reconnect-policy.test.ts` — **New**. Unit tests for delay calculation.
- `src/main/session.ts` — **Modified**. Added imports for new modules, removed inlined `classifyAudioError`/`classifyDisconnect` functions and 3 reconnect constants, updated `scheduleReconnect()` to use `getReconnectDelay()`. File reduced from 446 to 389 lines.

## Deviations from plan

None.

## New tasks or follow-up work

None discovered.
