# T9: Audio Capture

## Summary

Implement microphone audio capture in the Electron main process using `naudiodon` (PortAudio bindings), producing PCM audio suitable for streaming to Soniox.

## Scope

- Create `src/main/audio.ts`
- Open microphone via `naudiodon` with:
  - PCM signed 16-bit little-endian (s16le)
  - 16kHz sample rate
  - Mono (1 channel)
- Use system default input device unless overridden in Settings Store (`audioInputDevice`)
- Expose API:
  - `startCapture(onData: (chunk: Buffer) => void)` — start mic capture, call `onData` with PCM chunks (~100ms intervals = 3200 bytes)
  - `stopCapture()` — stop mic capture
  - `listDevices()` — return available audio input devices (for settings UI)
- Handle device unavailability: if the selected device is unavailable (e.g., USB headset unplugged), throw/emit an error — no automatic fallback
- **Fallback consideration**: if `naudiodon` proves problematic, document how to swap to Web Audio API in renderer (per `spec/decisions.md`)

## Acceptance Criteria

- Audio capture starts and produces PCM s16le 16kHz mono chunks
- Chunks are delivered at regular intervals (~100ms)
- Capture can be started and stopped cleanly
- Available input devices can be listed
- Device unavailability produces a clear error

## References

- `spec/architecture.md` — Audio Capture responsibilities
- `spec/decisions.md` — decision #5 (native audio capture, fallback plan)
- `spec/api.md` — audio format requirements (PCM s16le, 16kHz, mono)
