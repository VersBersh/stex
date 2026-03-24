# AUDIO: Sound event logging for VAD characterization

## Summary
Log sound events as `{ peak_dB, duration_ms, timestamp }` to help characterize keystrokes vs. speech patterns. This data will be useful for tuning Voice Activity Detection (VAD) parameters and distinguishing intentional speech from background noise like keystrokes.

This was originally a stretch goal in task 123 (Add visual volume dB meter with configurable silence threshold) that was deferred to keep that task focused on core acceptance criteria.

## Acceptance criteria
- Sound events are logged with `peak_dB`, `duration_ms`, and `timestamp` fields.
- Logging is structured (e.g., via the existing file-based logging system) so events can be analyzed after a session.
- Logging can be enabled/disabled (e.g., via a debug flag or log level) to avoid noise in normal operation.

## References
- Task 123: Add visual volume dB meter with configurable silence threshold (source of this stretch goal)
- `src/main/` audio processing modules
