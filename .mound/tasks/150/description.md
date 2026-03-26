# Connection Base Timestamp Tracking

## Summary

Introduce `connectionBaseMs` — the absolute session audio timestamp that corresponds to `0ms` in a given Soniox connection's token stream. Offset all incoming Soniox token timestamps by this value so that `TimestampedTextNode` `startMs`/`endMs` are always in session audio time, not per-connection time.

## Details

- Initial connection A: `connectionBaseMs = 0`
- Reopened connection B with replay: `connectionBaseMs = replayStartMs`
- Reopened connection B without replay: `connectionBaseMs = sessionAudioEndMsAtResume`
- Apply offset: `absoluteStartMs = connectionBaseMs + token.start_ms`, `absoluteEndMs = connectionBaseMs + token.end_ms`
- This is needed even when no replay occurs — a new connection always restarts token timestamps at 0

This task lays the groundwork for connection handoff by ensuring timestamp continuity across reconnects.

## Acceptance criteria

- [ ] `connectionBaseMs` is tracked per Soniox connection
- [ ] All incoming token `start_ms`/`end_ms` are offset by `connectionBaseMs` before being used to create `TimestampedTextNode`s
- [ ] Initial connection has `connectionBaseMs = 0` (no behavioral change for existing flow)
- [ ] The offset is applied in a single place (lifecycle or token commit layer) so future reconnect tasks only need to set `connectionBaseMs` correctly
- [ ] Existing transcription timestamps are unchanged (no regression)

## References

- `spec/proposal-context-refresh.md` — "Replay offset and timestamp mapping" section
- `src/` — `soniox-lifecycle.ts`, `TokenCommitPlugin.tsx`
