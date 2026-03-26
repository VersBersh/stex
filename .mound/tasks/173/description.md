# SONIOX: Handle zero-token replay drain edge case

## Summary
When replay audio contains only silence, Soniox may produce no final tokens at all. The current drain detection heuristic never triggers in this case, and the 10-second safety timeout is the only completion mechanism. This delays normal operation unnecessarily for the silence-only case.

Add a shorter timeout (e.g., 3 seconds) specifically for the case where zero tokens have been received after all replay audio has been sent. This would allow the replay phase to complete faster when the audio contains no speech.

## Acceptance criteria
- When replay audio is sent and zero final tokens are received within a short timeout (e.g., 3 seconds), the replay phase completes without waiting for the full 10-second safety timeout
- The existing drain detection heuristic continues to work normally when tokens are received
- The 10-second safety timeout remains as the ultimate fallback
- Tests cover the zero-token silence-only replay scenario

## References
- Source: task 154 discovered tasks
- Related: task 154 (replay ghost regions), task 155/170 (audio replay buffering)
- Key file: `src/main/soniox-lifecycle.ts` (drain detection logic in `sendReplayAudio`)
