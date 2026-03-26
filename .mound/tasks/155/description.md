# Audio Replay and Post-Resume Live Audio Buffering

## Summary

Implement the audio replay flow: on resume with re-transcription eligible, replay buffered audio from the ring buffer to the new Soniox connection. Buffer any post-resume live audio locally during replay, then flush it after replay completes.

## Details

Audio replay on resume:
1. Compute `effectiveReplayStartMs` from renderer's `replayStartMs` and main's `pendingStartMs`
2. Extract audio from the ring buffer via `sliceFrom(effectiveReplayStartMs)`
3. If the requested range has been evicted from the ring buffer, skip replay (reconnect still uses fresh context)
4. Send the replayed audio to connection B

Post-resume live audio buffering:
1. Mic capture restarts immediately on resume (user expects "unpause starts listening")
2. Newly captured live audio is buffered locally (not sent to Soniox) during replay
3. Replay is complete when: all replay audio sent AND Soniox has finalized the replay segment
4. After replay completes, flush buffered live audio to connection B and resume normal streaming
5. If no replay needed, flush any buffered post-resume audio immediately after B is ready

Send pacing note: the ring buffer timestamps come from captured sample count, not wall-clock send time. This remains true for locally-buffered post-resume audio.

## Acceptance criteria

- [ ] On eligible resume, audio from `effectiveReplayStartMs` is replayed to connection B
- [ ] Ring buffer miss (evicted audio) → replay skipped, reconnect still uses fresh context
- [ ] Mic capture resumes immediately on resume regardless of replay
- [ ] Post-resume live audio is buffered locally during replay phase
- [ ] After replay finalization, buffered live audio is flushed to B
- [ ] Without replay, buffered audio is flushed as soon as B is ready
- [ ] Session audio timeline remains monotonic through the entire sequence
- [ ] No audio is lost or duplicated in the capture→buffer→send pipeline

## References

- `spec/proposal-context-refresh.md` — "High-level flow" steps 9-12, "Connection handoff" section
- `src/` — `soniox-lifecycle.ts`
