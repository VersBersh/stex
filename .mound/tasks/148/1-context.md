# Context

## Relevant Files

- `src/main/audio.ts` — Main-process audio capture bridge; receives PCM chunks via IPC and forwards to consumers via `onData` callback
- `src/main/audio-level-monitor.ts` — Audio utility module with factory-pattern exports (`createAudioLevelMonitor`, `createSoundEventDetector`); good pattern reference for the ring buffer module
- `src/main/audio-level-monitor.test.ts` — Test file demonstrating the project's testing conventions (vitest, describe/it, direct imports, no mocking needed for pure logic)
- `src/main/soniox-lifecycle.ts` — Orchestrates audio capture → WebSocket flow; future consumer of AudioRingBuffer (not modified in this task)
- `spec/proposal-context-refresh.md` — Spec defining the ring buffer requirements: format, capacity, time tracking, API, and lifecycle
- `vitest.config.ts` — Test config; unit tests match `src/**/*.test.ts`

## Architecture

Audio flows from the renderer's AudioWorklet through IPC to the main process. Currently `soniox-lifecycle.ts` pipes chunks directly to `SonioxClient.sendAudio()`. The AudioRingBuffer will sit between capture and WebSocket, retaining recent audio for replay on pause-edit-resume.

The buffer is a standalone module with no dependencies on other project modules — it's a pure data structure operating on `Buffer` chunks with monotonic timestamp tracking. It follows the same pattern as `audio-level-monitor.ts`: a focused utility module in `src/main/` with co-located tests.

Key constraints:
- PCM 16-bit mono at 16kHz = 2 bytes per sample = 32 bytes/ms
- 5-minute capacity = 5 * 60 * 1000 * 32 = 9,600,000 bytes
- Time tracking uses sample count (chunk.length / 2), converted to ms at 16kHz (samples / 16)
- Chunks are stored with their start timestamp in the session audio timeline
- `sliceFrom(ms)` must handle: normal range, evicted timestamps, and empty buffer
