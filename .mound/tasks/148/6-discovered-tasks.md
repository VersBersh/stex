# Discovered Tasks

- **SONIOX-LIFECYCLE: Route audio through AudioRingBuffer**
  - Description: Modify `soniox-lifecycle.ts` to push audio chunks into `AudioRingBuffer` before sending to the WebSocket. Create the buffer at session start, destroy at session end.
  - Why: The ring buffer is now implemented but not yet wired into the audio pipeline. This is the next step in the context-refresh feature.
