# AudioRingBuffer Module

## Summary

Implement a new `AudioRingBuffer` module that sits between audio capture and the WebSocket, retaining recent PCM audio so that on pause-edit-resume, buffered audio can be replayed to a new Soniox connection.

## Details

- **Format**: PCM 16-bit mono at 16kHz (32 bytes/ms = 32KB/s)
- **Capacity**: 5 minutes (~9.6MB circular buffer)
- **Time tracking**: session-level monotonic sample counter, incremented by `chunk.length / 2` per chunk, converted to ms at 16kHz. Each chunk stored with its start timestamp in the session audio timeline.
- **API**:
  - `push(chunk)` — append audio, advance time counter
  - `sliceFrom(ms)` — return all buffered audio from the given timestamp onward
  - `clear()` — reset buffer and counters
- **Lifecycle**: created at session start, destroyed at session end. Audio accumulates during recording; buffer retains contents across pause so replay is available at resume.

The session audio timeline is distinct from Soniox per-connection token timestamps. This buffer provides the foundation for the context-refresh replay feature.

## Acceptance criteria

- [ ] `AudioRingBuffer` class exists with `push`, `sliceFrom`, and `clear` methods
- [ ] Buffer capacity is ~5 minutes of 16kHz PCM 16-bit mono audio
- [ ] `push` advances a monotonic session-time counter based on sample count
- [ ] `sliceFrom(ms)` returns concatenated audio from the given session timestamp to the buffer head
- [ ] Circular eviction: oldest chunks are dropped when capacity is exceeded
- [ ] `sliceFrom` returns empty/null if the requested timestamp has been evicted
- [ ] Unit tests cover push, slice, wraparound eviction, and edge cases

## References

- `spec/proposal-context-refresh.md` — "Audio ring buffer" section
