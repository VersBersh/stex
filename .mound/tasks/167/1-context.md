# Context

## Relevant Files

- `src/main/audio-ring-buffer.ts` — The `AudioRingBuffer` class: stores PCM chunks with computed timestamps, supports `push`, `sliceFrom`, `clear`. Uses capacity-based eviction (FIFO).
- `src/main/audio-ring-buffer.test.ts` — Existing unit tests for `AudioRingBuffer` covering push, sliceFrom, circular eviction, clear, and default capacity.
- `src/main/soniox.integration.test.ts` — Example integration test in the project (live Soniox API test), uses `.integration.test.ts` suffix.
- `vitest.config.ts` — Default vitest config includes `src/**/*.test.ts`, excludes `*.integration.test.ts`.
- `vitest.integration.config.ts` — Integration config includes `*.integration.test.ts` with 30s timeout.

## Architecture

`AudioRingBuffer` is a simple ring buffer that stores PCM audio chunks. Each chunk gets a `startMs` computed from cumulative sample count. When total bytes exceed capacity, oldest chunks are evicted (FIFO). `sliceFrom(ms)` uses binary search to find the chunk containing the given timestamp and returns a concatenated `Buffer` from that chunk onward. The buffer is used during recording sessions — audio is pushed during capture, and `sliceFrom` is called after pause to retrieve buffered audio for the transcription pipeline.

The existing test file already uses the real `AudioRingBuffer` (not mocked) and covers individual method behaviors. The task asks for additional integration-style tests that simulate realistic recording-then-pause workflows with data-integrity verification.
