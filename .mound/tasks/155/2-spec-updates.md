# Spec Updates: Audio Replay and Post-Resume Live Audio Buffering

No spec updates required.

The spec (`spec/proposal-context-refresh.md`) already describes the complete audio replay and post-resume buffering flow in detail (steps 9-12 of the high-level flow, the "Connection handoff" section, and the "Audio ring buffer" section). The spec covers:

- Computing `effectiveReplayStartMs` from renderer's `replayStartMs` and main's `pendingStartMs`
- Extracting replay audio via `sliceFrom()`
- Ring buffer miss handling (skip replay, reconnect still uses fresh context)
- Mic capture resuming immediately
- Local buffering of post-resume live audio during replay
- Flushing after replay finalization
- Flushing immediately when no replay needed

The implementation details in this plan (drain detection via `hasPendingNonFinalTokens`, timeout fallback, chunked replay sending) are implementation-level decisions that don't require spec changes.
