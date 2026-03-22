# SESSION: Decompose session.ts into focused modules

## Summary

`src/main/session.ts` is 382 lines and handles session state transitions, Soniox lifecycle, audio capture, reconnect policy, clipboard behavior, overlay/window orchestration, IPC wiring, and the onboarding guard. Extract reconnect policy and error classification into separate modules to reduce the file's number of reasons to change.

This was flagged by design review during T19 implementation as a Single Responsibility violation. The file has grown organically and now mixes many concerns.

## Acceptance criteria

- Reconnect policy logic (retry intervals, backoff, max attempts) is extracted to its own module (e.g. `src/main/reconnect-policy.ts`)
- Error classification logic (categorizing errors by type/severity) is extracted to its own module (e.g. `src/main/error-classification.ts`)
- `session.ts` imports and delegates to these modules instead of inlining the logic
- All existing tests pass after extraction
- No behavioral changes — pure refactor

## References

- `src/main/session.ts` — the file to decompose
- Discovered during T19 (First-Run Experience) implementation
