# Implementation Notes

## Files created

- `src/main/audio-ring-buffer.ts` — AudioRingBuffer class with push, sliceFrom, clear, currentMs, oldestMs
- `src/main/audio-ring-buffer.test.ts` — 19 unit tests covering all acceptance criteria

## Deviations from plan

None. Implementation follows the plan exactly.

## New tasks or follow-up work

- Integration into `soniox-lifecycle.ts`: route audio through the ring buffer instead of directly to WebSocket (covered by the broader context-refresh implementation tasks)
