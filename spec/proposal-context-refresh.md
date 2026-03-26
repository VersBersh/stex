# Proposal: Context Refresh on User Edit

## Problem

Soniox accepts a `context.text` parameter at connection time to improve transcription accuracy as a continuation of existing text. Currently, context is only set once at session start. If the user corrects a transcription error mid-session, the Soniox connection still uses the original (incorrect) context, potentially repeating the same mistake.

## Goal

When the user edits the transcript during a pause, reconnect to Soniox on resume with the corrected text as context, so subsequent transcription benefits from the correction. Optionally re-transcribe a trailing portion of already-finalized text that may have been "poisoned" by the original error.

## Design

### High-level flow

```
User is dictating (connection A active, audio streaming)
    |
User clicks Pause (or Ctrl+P)
    |
    v
1. Mic capture stops
2. Send empty buffer to A (finalize remaining tokens)
   — async, non-blocking; user can edit immediately
3. A's final tokens arrive in the background and commit
   as usual via onTokensFinal; ghost text clears
4. Connection A remains open but idle
    |
    ... user edits at leisure ...
    |
User clicks Resume (or Ctrl+P)
    |
    v
5. Determine re-transcription eligibility:
   a. Inspect the live editor state at the moment of
      resume (no pause-time snapshot)
   b. Find the latest dirty node (dirty TimestampedTextNode
      or plain TextNode)
   c. If it is within ~100 chars of the document end AND
      all nodes between it and the end are clean
      TimestampedTextNodes → eligible
   d. Set replayStartMs:
      - If the dirty node is a TimestampedTextNode and the
        text suffix after the edit matches the original text
        → use the dirty node's own startMs (replay includes
        its audio, giving Soniox full context)
      - Otherwise → use the startMs of the first clean node
        after the edit
   e. Otherwise → not eligible for re-transcription
6. Determine audio replay range:
   - If re-transcription eligible AND connection A had
     unfinalized tokens → replay from
     min(replayStartMs, startMs of first unfinalized token)
   - If re-transcription eligible only → replay from
     replayStartMs
   - If unfinalized tokens only → replay from startMs
     of the first unfinalized token
   - If neither → no replay needed
   - Renderer owns document analysis for eligibility and
     `replayStartMs`
   - Main owns audio/lifecycle state (pending non-final
     audio, ring-buffer availability, connection handoff)
   - Main captures `pendingStartMs` at pause time from the
     first unfinalized token, if any, and persists it across
     the handoff
   - Main combines both into the effective replay start
     used for audio replay
7. Close connection A
8. Open connection B with current editor text
   (including user corrections) as context
9. Replay buffered audio (if any) to B:
   - Before replay starts, the eligible clean tail is moved
     out of committed text and treated as replay ghost text
   - B's non-final tokens render into that replay ghost region
   - B's final tokens re-commit that replayed region via the
     normal token commit flow
   - Replayed audio that covers previously unfinalized audio
     is committed the same way
10. Resume mic capture immediately, but buffer newly captured
    live audio locally instead of sending it to B during replay
11. After replay finalization completes, flush the buffered
    post-resume live audio to B and continue normal streaming
12. If no replay is needed, flush any buffered post-resume
    audio immediately after B is ready and continue normal
    streaming
```

### Pause-edit-resume: why this first

The pause-edit-resume flow (see [inline-editing.md](features/inline-editing.md#pause-edit-resume-flow)) is the primary correction workflow. It eliminates race conditions inherent in editing during active transcription:

- No incoming tokens can interfere with the user's edits
- No cursor displacement risk
- The re-transcription decision is made at a clean boundary (resume), not mid-edit
- No debounce timing needed

A future iteration may support edit-during-recording with live context refresh (debounced reconnection, cursor-safe token replacement), but that adds significant complexity. The pause-resume flow covers the most common correction pattern with minimal risk.

Re-transcription eligibility is computed exactly once, on resume, from whatever is currently in the editor at that moment. There is no separate pause-time snapshot. If late final tokens from connection A arrived during pause and the user then edited them, the edited live document is authoritative.

### Audio ring buffer

Currently audio flows directly from capture to WebSocket (`onAudioData` -> `soniox.sendAudio`). This proposal introduces a ring buffer that sits between capture and the WebSocket. The buffer retains recent audio during recording so that when the user pauses and edits, the audio for the poisoned tail is available for replay to connection B on resume.

**Format**: PCM 16-bit mono at 16kHz = 32 bytes/ms = 32KB/s.

**Capacity**: 5 minutes (~9.6MB). The buffer must hold enough audio to cover the re-transcription tail. Since re-transcription is gated to ~100 characters from the document end, the audio range is modest — but the buffer should be generous to handle slow speakers and long words. 5 minutes covers any realistic tail at negligible memory cost.

**Time tracking**: The buffer tracks a session-level monotonic sample counter (incremented by `chunk.length / 2` for each chunk, converted to ms at 16kHz). Each chunk is stored with its start timestamp in this session audio timeline. This allows mapping `TimestampedTextNode` `startMs`/`endMs` back to buffer positions for replay.

This session audio timeline is distinct from Soniox's per-connection token timestamps:

- **Session audio time**: monotonic across the entire dictation session, regardless of pause/resume or connection handoff
- **Connection time**: Soniox `token.start_ms` / `token.end_ms`, which always start at `0` for a newly opened WebSocket

Each Soniox connection therefore carries a `connectionBaseMs`: the absolute session audio timestamp that corresponds to `0ms` in that connection's token stream.

- Initial connection A: `connectionBaseMs = 0`
- Reopened connection B with replay from `replayStartMs`: `connectionBaseMs = replayStartMs`
- Reopened connection B without replay: `connectionBaseMs = sessionAudioEndMsAtResume`

This means that even when no old audio is replayed, tokens returned by the new connection still need to be offset by the amount of session audio already captured before the reconnect.

**Lifecycle**: Created at session start, destroyed at session end. Audio accumulates continuously during recording. On pause, the buffer retains its contents so replay is available at resume. On resume, the buffer continues accumulating from the new connection.

Send pacing does not affect this timeline. The ring buffer's timestamps are derived from captured sample count, not wall-clock send time. This remains true even if post-resume live audio is temporarily buffered locally before being sent to Soniox.

```
AudioCapture -> RingBuffer -> active WebSocket
                    |
                    +-> replay slice -> new WebSocket (on resume)
```

### Connection handoff

On resume after an edit:

1. Close connection A (no audio is flowing, so no finalization needed)
2. Open connection B with the full editor text as `context.text`
3. If re-transcription is eligible, main sends `SESSION_REPLAY_GHOST_CONVERT` IPC to the renderer with `replayGhostStartMs` after connection B's `onConnected` fires. The renderer converts the clean tail to ghost text in a synchronous `historic`-tagged Lexical update and manually syncs the `editorBlockManager`. Ghost conversion fires only after connection B is confirmed open — if connection B fails, the editor is unchanged.
4. Replay the buffered audio for that region to B
5. B's non-final/final tokens refill that region through the normal ghost/final commit path
6. Mic capture restarts immediately on resume, but captured live audio is buffered locally during replay
7. Once replay completes, the buffered live audio is flushed to B and normal streaming resumes

### Dirty-leaf model and re-transcription of poisoned context

#### Node dirtiness

Each leaf node in the editor falls into one of three categories:

- **Clean `TimestampedTextNode`**: `text === originalText`. Untouched transcription with reliable `startMs`/`endMs` from Soniox.
- **Dirty `TimestampedTextNode`**: `text !== originalText`. User edited a transcribed word. The node still carries the original `startMs`/`endMs` from the audio that produced it.
- **Plain `TextNode`** (no timestamp metadata): user-created content (e.g., typed text, new paragraphs via Enter/Shift+Enter). Always dirty — no audio timestamps.

Only Soniox API tokens produce `TimestampedTextNode`s (one per word, after the sub-word merging step — see task 147). User typing naturally produces plain `TextNode`s.

#### The poisoned-context problem

When Soniox mistranscribes a word, subsequent words may also be transcribed incorrectly because the `context.text` was wrong. Correcting the error improves context, but the already-finalized text downstream of the edit is still "poisoned."

Example: Soniox transcribes *"I bought some bears at the store"* — the user corrects *"bears"* → *"beers"*. The words *"at the store"* were transcribed with *"bears"* in the context and may also be wrong.

#### Re-transcription scope

Rather than attempting sentence-boundary detection (ambiguous — abbreviations like "Mr." contain periods), we use a proximity heuristic:

1. **Proximity gate**: the edit must be within ~100 characters of the document end. Edits far from the end are unlikely to benefit from re-transcription — the context effect diminishes over distance, and those words have had more audio context of their own.

2. **Dirty-node guard**: walk from the first clean `TimestampedTextNode` after the edit to the document end. If **any** node in that range is dirty (plain `TextNode`, or `TimestampedTextNode` with `text !== originalText`), **skip re-transcription entirely**. We must not overwrite deliberate user edits.

3. **Paragraph-boundary guard**: only replay-replace within a single paragraph tail. If the dirty node and the candidate clean tail are not all in the same paragraph, skip re-transcription. The context refresh still applies to future audio.

4. **Re-transcription**: if all checks pass, the tail region is eligible. Replay audio from `replayStartMs` and replace the clean nodes with Soniox's re-transcription.

#### Replay offset and timestamp mapping

`replayStartMs` is determined by the dirty node:

- If the dirty node is a `TimestampedTextNode` and its current text ends with its `originalText` (`currentText.endsWith(originalText)`) → use the dirty node's own `startMs`. This means the user has prepended or otherwise preserved the original token text as a suffix of the edited node, so replay can safely regenerate that original-audio span with improved upstream context.
- Otherwise (plain `TextNode`, or no suffix match) → use the `startMs` of the first clean node after the edit.

The audio range is `[replayStartMs, endMs of last clean node]`.

Connection B's tokens have timestamps relative to its own audio stream. To map back to absolute timestamps for the new `TimestampedTextNode`s:

```
absoluteStartMs = connectionBaseMs + token.start_ms
absoluteEndMs   = connectionBaseMs + token.end_ms
```

Where:

- for replay, `connectionBaseMs = replayStartMs`
- for reconnect without replay, `connectionBaseMs = sessionAudioEndMsAtResume`

This preserves timestamp continuity across the edit boundary and across connection restarts generally.

If replay is skipped for any reason (paragraph boundary, dirty tail, ring-buffer miss, or ineligible edit), the reconnect still proceeds with fresh `context.text`; only the replay step is omitted.

#### Prefix/suffix matching for node replacement

When connection B returns re-transcribed tokens for the replay range:

1. **Prefix boundary**: the text before `replayStartMs` is authoritative and must not change. The context sent to Soniox includes this text, so B's output should naturally continue from it.

2. **Dirty node overlap / suffix-match case**: if `replayStartMs` is the dirty node's own `startMs`, B's re-transcription covers that node's audio too. This is only allowed when the dirty node's current text ends with its `originalText`.

   In that case, treat the node as having two conceptual parts:
   - an authoritative user-authored prefix
   - a replay-owned suffix equal to `originalText`

   Before replay begins, remove that replay-owned `originalText` suffix from committed text and fold it into the replay ghost region. The user-authored prefix remains committed and authoritative. Replay then regenerates the removed suffix plus any eligible clean tail after it.

   If the dirty node does not satisfy `currentText.endsWith(originalText)`, do not replay its own audio span; begin replay at the first clean node after it.

3. **Replay ghost conversion**: before replay begins, remove the clean `TimestampedTextNode`s in the eligible tail from committed text and represent them as replay ghost text. This preserves the invariant that the replayed region is not considered committed while Soniox is re-producing it.

4. **Normal re-commit**: finalized replay tokens are committed back into the editor as new `TimestampedTextNode`s (with remapped timestamps), tagged `historic` to bypass undo history, matching how normal token commits work.

If the re-transcribed text is identical to the original, the user still sees a transient remove-and-recommit cycle in that tail region, but the data model remains simpler because replay uses the same ghost/final semantics as live transcription.

Replay is considered complete when:

1. all replay audio has been sent to connection B, and
2. Soniox has finalized/drained that replay segment on B

Replay draining is detected by comparing incoming finalized token `end_ms` (connection-relative) against the replay audio duration in connection-relative time. The replay audio duration is computed from the byte length of the ring buffer slice at send time and frozen as `replayEndRelativeMs`. This value does NOT use `ringBuffer.currentMs` (which keeps growing as live audio is buffered). A 50ms tolerance accounts for Soniox not producing tokens for trailing silence. If no final tokens are received within 3 seconds of entering the drain phase, the replay is considered complete immediately — this handles the case where replay audio contains only silence and Soniox produces no tokens. A 10-second safety timeout remains as the ultimate fallback whenever replay draining has not completed by any other mechanism. Once draining is complete, `endReplayPhase()` flushes buffered post-resume live audio to connection B.

### What changes where

**New: `AudioRingBuffer`** (new module)
- Stores timestamped audio chunks in a circular buffer
- `push(chunk)` — append audio, advance time counter
- `sliceFrom(ms)` — return all buffered audio from the given timestamp onward
- `sliceFromWithMeta(ms)` — return `{ data: Buffer, actualStartMs: number }` so the caller can set `connectionBaseMs = actualStartMs` for correct timestamp mapping. The `actualStartMs` may differ from the requested `ms` due to chunk-boundary alignment.
- `clear()` — reset

**`soniox-lifecycle.ts`** — Changes:
- Route audio through ring buffer instead of directly to WebSocket
- On resume after an edit: close old connection, open new connection with fresh context
- If re-transcription eligible: replay audio for the tail region to the new connection
- Track a replay phase so post-resume live audio is buffered locally until replay has drained
- Capture and persist `pendingStartMs` at pause time if unfinalized tokens exist
- Offset replay/new-connection timestamps by `connectionBaseMs`
- Flush buffered post-resume live audio after replay finalization, then continue normal streaming

**`session.ts`** — Changes:
- Resume flow detects whether the editor was modified during pause
- Passes current editor text as context to the new connection
- Coordinates re-transcription eligibility check with the renderer
- Combines renderer replay analysis with main-process pending-audio state to determine the effective replay start

**`TokenCommitPlugin.tsx`** — Changes:
- Support replay ghost regions at the document tail
- Re-commit replay final tokens into that region using the normal final-token path
- Remap connection B's relative timestamps to absolute timestamps

**Renderer (new plugin or OverlayContext)** — New:
- Re-transcription eligibility check on resume: inspect the live editor state, apply proximity gate, dirty-node guard, and paragraph-boundary guard
- Convert the eligible clean tail into replay ghost text before replay begins
- Send a structured replay analysis result to main process on resume, including:
  - `eligible`
  - `replayStartMs`
  - `replayGhostStartMs`
  - `blockedReason`

Suggested shape:

```ts
interface ReplayAnalysisResult {
  eligible: boolean;
  replayStartMs: number | null;
  replayGhostStartMs: number | null;
  blockedReason: 'none' | 'paragraph-boundary' | 'dirty-tail' | 'too-far-from-end';
}
```

Main process combines this with its own pending-audio state:

```ts
effectiveReplayStartMs =
  !eligible ? pendingStartMs ?? null
  : pendingStartMs == null ? replayStartMs
  : Math.min(replayStartMs!, pendingStartMs)
```

If `blockedReason !== 'none'`, replay is skipped but reconnect still uses fresh `context.text`.

### What does NOT change

- `SonioxClient` — the WebSocket client itself is unchanged. The lifecycle layer creates a new instance for the new connection.
- Audio capture — pause/resume semantics are unchanged.
- Editor rendering — ghost text and committed text rendering are unchanged.
- The ghost-text concept is unchanged, but it now has two sources in v1: live non-final tokens and replay-in-progress tail text. The two sources are temporally exclusive — during replay, live audio is buffered locally and no live non-final tokens arrive. The ghost text CSS property (`--ghost-text-content`) is shared; no structural change to ghost text rendering is needed.
- Inline editing during active transcription — unchanged; context refresh only applies to the pause-edit-resume flow in v1.

## Risks and open questions

**Audio replay correctness**: Soniox token timestamps are relative to the audio stream of a given connection. When we replay buffered audio to connection B, B's timestamps start from 0. We need to map between "ring buffer absolute time" and "per-connection relative time." This is straightforward but needs careful bookkeeping.

**Reconnect timestamp offset**: even without replay, a newly opened Soniox connection restarts its token timestamps at `0`. The lifecycle must offset those timestamps by the session audio time already accumulated before the reconnect (`connectionBaseMs`), otherwise newly committed `TimestampedTextNode`s will overlap earlier ones in absolute time.

**Replay UX flicker**: because the v1 design converts the eligible clean tail back into ghost text and then re-commits it, the user may briefly see that tail transition from committed text to ghost text and back. This is acceptable if the replay region is short, but worth validating in practice.

**Buffered live audio on resume**: if the user starts speaking immediately on resume, that audio is captured before replay completes. In v1, this post-resume live audio is buffered locally and sent only after replay finalization drains. This preserves the expected "unpause starts listening" UX without requiring replay/live overlap on the Soniox connection.

**Ring buffer wraparound**: if the re-transcription tail's `startMs` falls outside the ring buffer's 5-minute window (e.g., the user has been dictating for a long time and the edit is near the end of old audio), the replay audio is lost. In this case, skip re-transcription — the context refresh still benefits future transcription even without replay.

**Context quality**: Does Soniox actually produce noticeably better results with corrected context vs. original context? Worth validating empirically before investing in the full implementation. A quick test: manually start two sessions with different context text and compare transcription of the same utterance.

**Future: edit-during-recording**: the full vision includes context refresh while recording (debounced reconnection, cursor-safe token replacement mid-edit). This proposal deliberately defers that to a future iteration to keep the initial implementation simple and safe.
