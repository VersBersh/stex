# Visual volume dB meter with configurable silence threshold

## Summary

Add a real-time volume meter that shows audio input level in dB, both as a UI indicator during dictation and as a configurable silence threshold in settings. This provides user feedback ("is my mic working?") and lays the groundwork for voice activity detection (VAD) used by the context refresh feature.

## Detail

### dB meter component

Compute RMS energy of each PCM 16-bit audio chunk and convert to dB: `20 * log10(rms / 32768)`. Values range from ~-60dB (silence) to 0dB (clipping). Apply a short rolling average to avoid flicker.

Render as a small horizontal bar in the UI, updated on each audio chunk callback. Color-coded: dim for ambient, green for speech-level.

### Settings page

Display the same dB meter bar with a draggable threshold line. "Anything below this line counts as silence." Persist the threshold as a user preference. This threshold feeds into VAD logic for the context refresh feature.

### Sound event logging (stretch)

Log sound events as `{ peak_dB, duration_ms, timestamp }` to help characterize:
- **Keystrokes**: sharp spike (~-20dB), very short duration (5-20ms), repeated at typing cadence
- **Speech**: sustained energy (-30 to -10dB), longer duration (100ms+), smoother envelope

This data can inform empirical VAD parameters — "speech is sustained energy above X dB for at least Y ms" with real numbers from the user's actual environment.

## Acceptance criteria

- [ ] Real-time volume bar visible during active dictation, showing current audio input level in dB
- [ ] Bar updates smoothly (rolling average, no flicker)
- [ ] Settings page shows the same bar with a draggable silence threshold
- [ ] Threshold value persisted to user preferences
- [ ] Threshold value accessible to other modules (for future VAD consumption)

## References

- `spec/proposal-context-refresh.md` — context refresh proposal that will consume the silence threshold for VAD
