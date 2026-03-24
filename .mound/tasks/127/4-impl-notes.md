# Implementation Notes

## Files modified

- `src/main/index.ts` — Added `debug` import and startup timing logs after each init step using `performance.now()` for cumulative elapsed time
- `src/main/soniox.ts` — Replaced partial config log with full config dump (excluding `api_key` and `context`); added debug summary in `handleMessage()` with token counts and finished flag
- `src/main/soniox-lifecycle.ts` — Added `audioChunkCount` module variable; `onAudioData()` logs every 100 chunks with count, size, and dB; counter reset in `connectSoniox()` and `resetLifecycle()`

## Deviations from plan

None.

## New tasks or follow-up work

None.
