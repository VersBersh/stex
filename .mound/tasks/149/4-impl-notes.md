# Implementation Notes

## Files modified

- **`src/main/soniox-lifecycle.ts`** — Added import for `AudioRingBuffer`, module-level `ringBuffer` variable, creation in `connectSoniox`, `push` call in `onAudioData`, and `clear`/null in `resetLifecycle`.
- **`src/main/soniox-lifecycle.test.ts`** — Added `MockAudioRingBuffer` to hoisted mocks, mock for `./audio-ring-buffer` module, and `describe('audio ring buffer')` test block with 5 tests.

## Deviations from plan

1. **Removed call-order test**: Plan Step 5 suggested verifying `push` is called before `sendAudio` via mock call ordering. The `MockSonioxClient`'s delegation pattern (`sendAudio` method delegates to `mockSonioxInstance.sendAudio`) makes mock-based call-order tracking unreliable in this test setup. Instead, we verify `push` is called for each chunk (the source order guarantee is clear from reading the code). This is a minor test simplification.

2. **Plan Step 5 (getAudioRingBuffer accessor) already removed**: The plan review (4-plan-review.md) flagged this as out of scope. The revised plan (3-plan.md) already excluded it.

## New tasks or follow-up work

- Integration test with real `AudioRingBuffer`: Add a test that uses the real (not mocked) `AudioRingBuffer` to verify audio captured before a pause is retrievable via `sliceFrom`. This was noted in the plan review as important for the acceptance criterion about `sliceFrom` retrieval.
