# Proposal: Context Refresh on User Edit

## Problem

Soniox accepts a `context.text` parameter at connection time to improve transcription accuracy as a continuation of existing text. Currently, context is only set once at session start. If the user corrects a transcription error mid-session, the Soniox connection still uses the original (incorrect) context, potentially repeating the same mistake.

## Goal

When the user edits the transcript (click or keystroke), automatically reconnect to Soniox with the corrected text as context, so subsequent transcription benefits from the correction. This should be seamless — no lost audio, no visible interruption.

## Design

### High-level flow

```
User is dictating (connection A active, audio streaming)
    |
User clicks/types in editor
    |
    v
1. Stop sending audio to connection A
2. Send empty buffer to A (finalize remaining tokens)
3. Continue buffering audio locally
4. Ghost text from A stays visible (read-only)
    |
    ... user edits ...
    |
1s passes with no keystrokes
    |
    v
5. Open connection B with current finalized text as context
6. Connection B becomes sole token authority
7. Close connection A immediately (no finalize wait)
8. If ghost text from A still visible, replay audio buffer
   from the start_ms of the first ghost text token
9. Resume streaming live audio to B
```

### Audio ring buffer

Currently audio flows directly from capture to WebSocket (`onAudioData` -> `soniox.sendAudio`). This proposal introduces a ring buffer that sits between capture and the WebSocket.

**Format**: PCM 16-bit mono at 16kHz = 32 bytes/ms = 32KB/s.

**Capacity**: 5 minutes (~9.6MB). The buffer must hold all audio from the moment we stop sending to connection A until connection B is ready: editing duration + 1s debounce + connection setup. Users can easily edit for over 30 seconds (correcting multiple terms, restructuring a paragraph), so the buffer must be generous. 5 minutes covers the vast majority of editing sessions at negligible memory cost. Audio older than 5 minutes was almost certainly finalized by connection A before the pause, so ring-buffer wraparound loses nothing needed for replay.

**Time tracking**: The buffer tracks a monotonic sample counter (incremented by `chunk.length / 2` for each chunk, converted to ms at 16kHz). Each chunk is stored with its start timestamp. This allows mapping Soniox token `start_ms`/`end_ms` back to buffer positions for replay.

**Lifecycle**: Created at session start, destroyed at session end. The buffer continues to accumulate audio during the edit pause (audio capture is never stopped).

```
AudioCapture -> RingBuffer -> active WebSocket
                    |
                    +-> replay slice -> new WebSocket (on reconnect)
```

### Connection handoff

**Invariant**: Only one connection provides tokens at a time. The "active connection" is the sole authority for new tokens.

**Handoff sequence**:

1. Connection B opens and sends config (with fresh context)
2. The moment B's `onConnected` fires, it becomes the active connection
3. Connection A is closed immediately (no finalize, no waiting for `finished`)
4. Any late-arriving tokens from A are discarded (the existing `if (socket !== this.ws) return` guard in `SonioxClient` already handles this)
5. Ghost text from A is cleared (B will produce its own)
6. If there was ghost text from A, replay the audio buffer from that ghost text's `start_ms` to B, then continue with live audio

**Why no finalize on A**: We already sent the empty buffer to A when the user started editing (step 2 in the high-level flow). By the time B connects, A has had 1+ seconds to finalize. Any remaining non-final tokens from A are stale — B will re-transcribe that audio with better context.

### Ghost text during edit pause

When the user starts editing:
- Ghost text from connection A stays visible as-is (it's CSS-only, read-only)
- If A sends a finalization response, the final tokens replace the ghost text as committed text (normal flow)
- If A doesn't finalize before B takes over, ghost text is cleared when B becomes active

This means the user sees a natural transition: ghost text either gets committed (if A finalized quickly) or disappears and gets re-transcribed by B.

### Trigger: detecting user edits

The renderer already has `InlineEditPlugin` which detects user edits (skips `historic`-tagged updates). The trigger should be:

1. **First edit** (click or keystroke): send IPC to main process signaling "user is editing"
2. **Main process**: stops sending audio to Soniox, sends finalize, starts accumulating audio in ring buffer
3. **Debounce**: after 1 second of no edits, send IPC to main process signaling "editing paused"
4. **Main process**: opens new connection with fresh context

The 1-second debounce avoids thrashing connections on rapid edits.

### What changes where

**New: `AudioRingBuffer`** (new module)
- Stores timestamped audio chunks in a circular buffer
- `push(chunk)` — append audio, advance time counter
- `sliceFrom(ms)` — return all buffered audio from the given timestamp onward
- `clear()` — reset

**`audio.ts`** — No changes to capture itself. The ring buffer sits in the lifecycle layer.

**`soniox-lifecycle.ts`** — Significant changes:
- Route audio through ring buffer instead of directly to WebSocket
- New `pauseForEdit()` — finalize current connection, stop sending audio, keep buffering
- New `reconnectWithContext(contextText)` — open new connection, handle handoff, replay audio
- Track which connection is "active" for token dispatch

**`session.ts`** — New IPC handlers:
- `SESSION_EDIT_START` — renderer signals user started editing
- `SESSION_EDIT_IDLE` — renderer signals 1s has passed since last edit
- Wire up the pause-for-edit and reconnect-with-context flows

**`TokenCommitPlugin.tsx` / `GhostTextPlugin.tsx`** — Minimal changes:
- Need to track `start_ms` of current ghost text tokens for replay offset

**Renderer (new plugin or OverlayContext)** — Edit detection + debounce:
- Listen for non-historic editor updates
- Send `SESSION_EDIT_START` on first edit
- Debounce 1s, then send `SESSION_EDIT_IDLE`

### What does NOT change

- `SonioxClient` — the WebSocket client itself is unchanged. The lifecycle layer creates a new instance for the new connection.
- Audio capture — `startCapture`/`stopCapture` are not called during reconnect. Audio keeps flowing.
- Editor rendering — ghost text and committed text rendering are unchanged.

## Risks and open questions

**Audio replay correctness**: Soniox token timestamps are relative to the audio stream of a given connection. When we replay buffered audio to connection B, B's timestamps start from 0. We need to map between "ring buffer absolute time" and "per-connection relative time." This is straightforward but needs careful bookkeeping.

**Rapid edit cycles**: If the user edits, waits 1s (triggering reconnect), then immediately edits again before B is connected — we need to cancel the pending reconnect and restart the debounce. The lifecycle state machine needs to handle: `recording -> editing -> reconnecting -> editing` gracefully.

**Context quality**: Does Soniox actually produce noticeably better results with corrected context vs. original context? Worth validating empirically before investing in the full implementation. A quick test: manually start two sessions with different context text and compare transcription of the same utterance.

**Connection latency**: If the WebSocket handshake takes > 500ms (bad network), the user might resume speaking before B is ready. The ring buffer handles this (audio is buffered), but the user would see a gap in ghost text. Acceptable trade-off.
