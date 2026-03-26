# Spec Updates — Task 154: Replay Ghost Regions

## Spec changes required

### 1. `spec/proposal-context-refresh.md` — Clarify replay ghost conversion trigger

**Section:** "Connection handoff" (step 3)

**What needs to change:** The spec says "convert the eligible clean tail into a replay ghost region" but does not specify the IPC mechanism or trigger timing. Add:

- After connection B opens (`onConnected`), main sends `SESSION_REPLAY_GHOST_CONVERT` IPC with `replayGhostStartMs` to the renderer, then immediately sends replay audio.
- Ghost conversion fires only after connection B is confirmed open. If connection B fails, the editor is unchanged.
- The renderer performs the conversion inside a `historic`-tagged Lexical update and manually syncs the `editorBlockManager`.

**Why:** The implementation needs a clear trigger point. Placing conversion after `onConnected` avoids de-committing the editor on connection failure.

### 2. `spec/proposal-context-refresh.md` — Define replay completion contract

**Section:** "Prefix/suffix matching for node replacement" → "Replay is considered complete when..."

**What needs to change:** The spec says replay is complete when "all replay audio has been sent to connection B AND Soniox has finalized/drained that replay segment." Clarify the concrete mechanism:

- Replay draining is detected by comparing incoming finalized token `end_ms` (connection-relative) against the replay audio duration in connection-relative time.
- The replay audio duration is computed from the byte length of the ring buffer slice at send time and frozen as `replayEndRelativeMs`. This value does NOT use `ringBuffer.currentMs` (which keeps growing as live audio is buffered).
- A 50ms tolerance accounts for Soniox not producing tokens for trailing silence.
- A 10-second safety timeout forces replay completion if the heuristic doesn't trigger.
- Once draining is complete, `endReplayPhase()` flushes buffered post-resume live audio to connection B.

**Why:** The spec's original phrasing ("finalized/drained") is ambiguous. The heuristic approach avoids explicit finalization (which would close the connection) while providing reliable completion detection.

### 3. `spec/proposal-context-refresh.md` — Document ring buffer slice boundary handling

**Section:** "Audio ring buffer"

**What needs to change:** Add documentation about the `sliceFromWithMeta(ms)` API and the `actualStartMs` concept:

- `sliceFrom(ms)` returns audio starting from the last chunk with `startMs <= ms`. The actual start may be earlier than the requested `ms` due to chunk boundaries.
- `sliceFromWithMeta(ms)` returns `{ data: Buffer, actualStartMs: number }` so the caller can set `connectionBaseMs = actualStartMs` for correct timestamp mapping.
- The spec's formula `connectionBaseMs = replayStartMs` should be refined to `connectionBaseMs = actualReplayStartMs` (the `actualStartMs` from the ring buffer slice).

**Why:** Without this, token timestamps from connection B would be offset incorrectly if the replay audio starts at a chunk boundary earlier than `replayStartMs`.

### 4. `spec/proposal-context-refresh.md` — Clarify ghost text source exclusivity

**Section:** "What does NOT change" → ghost-text concept bullet

**What needs to change:** Current text: "The ghost-text concept is unchanged, but it now has two sources in v1: live non-final tokens and replay-in-progress tail text." Clarify:

- The two sources are temporally exclusive — during replay, live audio is buffered locally and no live non-final tokens arrive from Soniox.
- The ghost text CSS property (`--ghost-text-content`) is shared. No structural change to ghost text rendering is needed.
- Initial replay ghost text is set by the conversion function. Subsequent non-final tokens from connection B overwrite it through the normal `GhostTextPlugin` path.

**Why:** The "two sources" phrasing could be misinterpreted as needing a multi-source ghost text system. Clarifying temporal exclusivity simplifies the implementation.

## New spec content

No new spec files needed. All changes fit within the existing `proposal-context-refresh.md` structure.
