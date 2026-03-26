# AUDIO: Add integration test for ring buffer audio retrieval via sliceFrom

## Summary
Add an integration test (using the real `AudioRingBuffer`, not mocked) that verifies audio captured during recording can be retrieved via `sliceFrom` after a pause. Unit tests with a mocked buffer only verify wiring (push/clear calls), not that data actually flows correctly through the real buffer. This test covers the acceptance criterion that buffered audio is retrievable.

## Acceptance criteria
- A new test exists that uses the real `AudioRingBuffer` (not mocked) in a recording-then-pause scenario
- The test pushes timestamped PCM audio into the buffer, then calls `sliceFrom` and verifies the correct audio data is returned
- The test covers edge cases: slicing from the middle of buffered data, slicing when the ring has wrapped around
- Test passes in CI

## References
- Source: .mound/tasks/149/6-discovered-tasks.md (discovered during task 149 — Route audio capture through AudioRingBuffer)
- AudioRingBuffer module: src/main/audio-ring-buffer.ts
- Existing tests: src/main/__tests__/audio-ring-buffer.test.ts
