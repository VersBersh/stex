# Plan

## Goal

Add integration-style tests to `audio-ring-buffer.test.ts` that simulate recording-then-pause scenarios and verify data integrity through `sliceFrom`, including mid-buffer slicing and wrap-around edge cases.

## Steps

1. **Add tests to `src/main/audio-ring-buffer.test.ts`** — Add a new `describe('integration: recording-then-pause')` block with the following tests:

   a. **Basic recording-then-pause retrieval**: Push multiple chunks with identifiable byte patterns (e.g., incrementing tag values), call `sliceFrom(0)`, verify the concatenated result contains all pushed data in order.

   b. **Slice from middle of buffered data**: Push several tagged chunks, call `sliceFrom` with a mid-stream timestamp, verify only the expected suffix of chunks is returned with correct data.

   c. **Slice after wrap-around (eviction)**: Use a small-capacity buffer, push enough data to trigger eviction, then call `sliceFrom` at the oldest surviving timestamp and verify the returned data matches the surviving chunks.

   d. **Clear-then-record cycle**: Push data, clear, push new data, sliceFrom — verifying the second recording session's data is correct and the first session's data is gone.

   Each test will use a helper that creates PCM buffers with a known tag value written at offset 0 for identification.

## Risks / Open Questions

- None. The `AudioRingBuffer` is a pure in-memory data structure with no external dependencies. All tests are deterministic.
