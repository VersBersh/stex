# Discovered Tasks

1. **AUDIO: Add integration test for ring buffer audio retrieval via sliceFrom**
   - Description: Add a test (using the real `AudioRingBuffer`, not mocked) that verifies audio captured during recording can be retrieved via `sliceFrom` after a pause. This covers the acceptance criterion that buffered audio is retrievable.
   - Why: The plan review flagged that unit tests with a mocked buffer only verify wiring (push/clear calls), not that data actually flows correctly through the real buffer. The acceptance criterion "Ring buffer accumulates audio that can be retrieved via `sliceFrom` during a pause" is not testable with mocks alone.
