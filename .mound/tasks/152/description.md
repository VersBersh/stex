# Connection Handoff on Resume

## Summary

Implement the core pause-edit-resume reconnection flow: when the user resumes after editing, close the old Soniox connection and open a new one with the current editor text as `context.text`.

## Details

On resume after an edit:
1. Close connection A (no audio flowing, so no finalization needed)
2. Open connection B with the full editor text as `context.text`
3. Set `connectionBaseMs` appropriately:
   - With replay: `connectionBaseMs = replayStartMs`
   - Without replay: `connectionBaseMs = sessionAudioEndMsAtResume`
4. Resume mic capture and start streaming to connection B

This task does NOT include replay or ghost-text conversion — it focuses on the basic reconnect-with-fresh-context path. Even without replay, subsequent transcription benefits from the corrected context.

The session layer (`session.ts`) coordinates: it detects whether the editor was modified during pause, requests `ReplayAnalysisResult` from the renderer, and instructs the lifecycle to reconnect.

## Acceptance criteria

- [ ] On resume after editor modification, old connection is closed and new connection opened
- [ ] New connection receives full current editor text as `context.text`
- [ ] `connectionBaseMs` is set correctly for the new connection
- [ ] If no edit occurred during pause, existing connection is reused (no reconnect)
- [ ] Mic capture resumes and audio streams to the new connection
- [ ] Session layer coordinates the renderer's replay analysis and lifecycle reconnect
- [ ] No regression in normal pause/resume without edits

## References

- `spec/proposal-context-refresh.md` — "Connection handoff" and "High-level flow" sections
- `src/` — `soniox-lifecycle.ts`, `session.ts`
