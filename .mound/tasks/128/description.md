# Reset volume meter on session pause/stop/disconnect

## Summary

The `VolumeMeter` component (`src/renderer/overlay/components/VolumeMeter.tsx`) renders whatever dB value it last received. When audio capture stops (pause, stop, or disconnect), nothing sends a reset value, so the meter stays frozen showing the last level — often appearing stuck on high volume.

The volume data comes from the same audio stream sent to Soniox (`soniox-lifecycle.ts:93-99`). When `stopCapture()` is called, no more `onAudioLevel` callbacks fire, leaving the UI stale.

## Acceptance criteria

- A reset audio level (MIN_DB = -60) is sent via the `onAudioLevel` callback when audio capture ends, specifically:
  - `handleDisconnect()` calls `stopCapture()` (`soniox-lifecycle.ts:77`)
  - Session pauses (`session.ts:117`)
  - Session stops (`session.ts:154`)
  - Audio error occurs (`soniox-lifecycle.ts:104`)
- The volume meter visually drops to zero/empty in all of the above scenarios
- Consider adding auto-decay in the renderer as a safety net: if no audio level update arrives within ~500ms, animate the meter down to zero
- Existing tests pass

## References

- `src/renderer/overlay/components/VolumeMeter.tsx` — renders dB as a bar width
- `src/main/soniox-lifecycle.ts:93-99` — `onAudioData()` computes and sends dB
- `src/main/audio-level-monitor.ts` — MIN_DB = -60, moving average smoother
- `src/main/session.ts` — session lifecycle (pause at line 111, stop at line 145)
