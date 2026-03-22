# Implementation Notes

## Files created or modified

- `src/shared/types.ts` — Added `'no-api-key'` to `ErrorInfo.type` union
- `src/main/session.ts` — Added API key guard in `requestToggle()`: checks for empty API key, shows overlay with setup prompt error instead of starting session; clears error when API key exists
- `src/main/index.ts` — Extracted `initApp()` function, added first-run check to auto-open settings window when no API key configured
- `src/main/session.test.ts` — Added `describe('API key guard')` block with 5 tests
- `src/main/first-run.test.ts` — New test file for first-run auto-open settings behavior

## Deviations from plan

- `src/main/session-reconnect.test.ts` — Fixed 2 pre-existing tests that broke because the new `clearError()` call in `requestToggle()` sends `null` via `SESSION_ERROR` before starting a session. The tests were checking `errorCalls[0]` (first error) but the first call is now the null clear. Fixed by filtering out null calls: `.filter(c => c[1] !== null)`. This is a minimal, correct fix since null payloads are error clears, not actual errors.

## Review fixes applied

- Fixed `ErrorInfo | null` typing contract end-to-end (design review Major issue):
  - `src/main/session.ts` — Changed `sendError` parameter type from `ErrorInfo` to `ErrorInfo | null`, removed `as unknown as ErrorInfo` cast in `clearError()`
  - `src/renderer/types.d.ts` — Changed `onSessionError` callback parameter from `ErrorInfo` to `ErrorInfo | null`
  - `src/main/preload.ts` — Already used `unknown` type, no change needed

## New tasks or follow-up work

1. **Session module decomposition**: `session.ts` is 382 lines and handles session state, Soniox lifecycle, audio capture, reconnect policy, clipboard, overlay orchestration, IPC wiring, and now onboarding guard. Consider extracting reconnect policy and error handling into separate modules.

2. **`window.electronAPI` preload bridge**: The overlay renderer uses `window.electronAPI` for actions like `openSettings()`, `dismissError()`, but the preload that exposes this API may not be fully wired. The "Open Settings" action button in the no-api-key error depends on this bridge working.
