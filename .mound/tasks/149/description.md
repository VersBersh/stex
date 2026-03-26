# Route Audio Through Ring Buffer

## Summary

Wire the `AudioRingBuffer` into the existing audio pipeline in `soniox-lifecycle.ts`. Currently audio flows directly from capture to WebSocket (`onAudioData` → `soniox.sendAudio`). After this task, audio flows through the ring buffer first: `AudioCapture → RingBuffer → active WebSocket`.

## Details

- Create and manage the ring buffer instance in the lifecycle module (create at session start, destroy at session end)
- Intercept `onAudioData` to push each chunk into the ring buffer before forwarding to the active WebSocket
- No behavioral change to the existing flow — audio still reaches the WebSocket in real time
- The ring buffer simply accumulates audio silently for future replay use

## Acceptance criteria

- [ ] Ring buffer is instantiated at session start and cleared/destroyed at session end
- [ ] Every audio chunk passes through `ringBuffer.push(chunk)` before being sent to Soniox
- [ ] Existing transcription behavior is unchanged (no regression)
- [ ] Ring buffer accumulates audio that can be retrieved via `sliceFrom` during a pause

## References

- `spec/proposal-context-refresh.md` — "Audio ring buffer" section
- `src/` — `soniox-lifecycle.ts`
