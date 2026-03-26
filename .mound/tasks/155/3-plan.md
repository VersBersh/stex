# Plan: Audio Replay and Post-Resume Live Audio Buffering

## Goal

Implement the main-process audio replay pipeline on resume (extract ring-buffer audio, send to connection B, buffer post-resume live audio during replay, flush on drain) so that the pause-edit-resume flow preserves audio continuity.

## Scope note

This task implements the **main-process audio pipeline** half of replay: extracting audio, sending it to Soniox, buffering/flushing live audio, and detecting replay drain. The renderer-side ghost text conversion (moving the clean tail into a replay ghost region, recommitting replay finals) is a separate task that depends on this one. The audio pipeline is independently testable — replay tokens flow through the normal `onFinalTokens`/`onNonFinalTokens` callbacks, and the renderer handles them via the existing token commit path. Without the renderer ghost conversion task, replay tokens would append to the document tail rather than replacing the eligible clean region, but the audio pipeline itself is correct and complete.

## Steps

### Step 1: Add `sliceFromWithStart()` to `AudioRingBuffer`

**File**: `src/main/audio-ring-buffer.ts`

`sliceFrom(ms)` returns the containing chunk when `ms` falls mid-chunk, but doesn't report the actual start time of that chunk. Setting `connectionBaseMs = effectiveReplayStartMs` while audio actually starts at an earlier chunk boundary misaligns remapped token timestamps.

Add a new method alongside `sliceFrom`:

```typescript
sliceFromWithStart(ms: number): { buffer: Buffer; actualStartMs: number } | null {
  if (this.chunks.length === 0) return null;
  if (ms < this.chunks[0].startMs) return null;
  if (ms >= this.currentMs) return null;

  // Binary search for the last chunk with startMs <= ms (same as sliceFrom)
  let lo = 0;
  let hi = this.chunks.length - 1;
  let idx = 0;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (this.chunks[mid].startMs <= ms) {
      idx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return {
    buffer: Buffer.concat(this.chunks.slice(idx).map((c) => c.data)),
    actualStartMs: this.chunks[idx].startMs,
  };
}
```

This returns the concatenated buffer AND the `startMs` of the first included chunk, so the caller can use the accurate start time for `connectionBaseMs`.

**Depends on**: nothing

### Step 2: Add tests for `sliceFromWithStart()` in `audio-ring-buffer.test.ts`

**File**: `src/main/audio-ring-buffer.test.ts`

Add a `describe('sliceFromWithStart')` block:

1. Returns `null` for empty buffer, evicted range, and beyond-currentMs
2. Returns `actualStartMs` matching the containing chunk start when `ms` falls mid-chunk (e.g., `ms=50` inside chunk starting at `0ms` returns `actualStartMs=0`)
3. Returns `actualStartMs` matching exact chunk boundary (e.g., `ms=100` returns `actualStartMs=100`)
4. Buffer contents match `sliceFrom()` output for the same `ms`

**Depends on**: Step 1

### Step 3: Add replay and buffering state to `soniox-lifecycle.ts`

**File**: `src/main/soniox-lifecycle.ts`

Add new module-level state variables after the existing declarations (line ~32):

```typescript
let replayPhase: 'idle' | 'draining' = 'idle';
let postResumeLiveBuffer: Buffer[] = [];
let bufferLiveAudio = false;
let replayDrainTimer: ReturnType<typeof setTimeout> | null = null;
```

- `replayPhase` — whether we are waiting for Soniox to finalize replay audio
- `postResumeLiveBuffer` — locally buffered live audio chunks captured during replay or pre-connection
- `bufferLiveAudio` — when true, `onAudioData` stores chunks in the local buffer instead of sending to Soniox
- `replayDrainTimer` — fallback timeout for replay drain detection

Update `resetLifecycle()` to clear these:

```typescript
replayPhase = 'idle';
postResumeLiveBuffer = [];
bufferLiveAudio = false;
if (replayDrainTimer) { clearTimeout(replayDrainTimer); replayDrainTimer = null; }
```

**Depends on**: nothing

### Step 4: Modify `onAudioData()` to support buffering

**File**: `src/main/soniox-lifecycle.ts`

Change the `onAudioData` function (line ~154) to conditionally buffer:

```typescript
function onAudioData(chunk: Buffer): void {
  ringBuffer?.push(chunk);
  if (bufferLiveAudio) {
    postResumeLiveBuffer.push(chunk);
  } else {
    soniox?.sendAudio(chunk);
  }
  // ... audio level monitoring and logging unchanged ...
}
```

The ring buffer always receives audio (it tracks session-level time monotonically). The routing decision affects only whether audio is sent to Soniox immediately or held in the local buffer.

**Depends on**: Step 3

### Step 5: Add `flushLiveBuffer()` and `completeReplay()` internal functions

**File**: `src/main/soniox-lifecycle.ts`

Add two new internal functions:

```typescript
function flushLiveBuffer(): void {
  const chunks = postResumeLiveBuffer;
  postResumeLiveBuffer = [];
  bufferLiveAudio = false;
  for (const chunk of chunks) {
    soniox?.sendAudio(chunk);
  }
  debug('Flushed %d buffered live audio chunks', chunks.length);
}

function completeReplay(): void {
  if (replayDrainTimer) { clearTimeout(replayDrainTimer); replayDrainTimer = null; }
  replayPhase = 'idle';
  info('Replay drain complete, flushing buffered live audio');
  flushLiveBuffer();
}
```

`flushLiveBuffer()` sends all accumulated chunks to Soniox in order and switches audio routing back to direct streaming. `completeReplay()` cleans up replay state and then flushes.

**Depends on**: Step 3

### Step 6: Add replay drain detection to token callbacks in `reconnectWithContext()`

**File**: `src/main/soniox-lifecycle.ts`

In the `reconnectWithContext()` function, the `onFinalTokens` and `onNonFinalTokens` callbacks currently just apply timestamp offsets and forward. Add drain detection checks:

In the `onFinalTokens` callback (inside the SonioxClient constructor in `reconnectWithContext`):

```typescript
onFinalTokens: (tokens: SonioxToken[]) => {
  if (!soniox?.hasPendingNonFinalTokens) {
    lastNonFinalStartMs = null;
  }
  callbacks.onFinalTokens(applyTimestampOffset(tokens, baseMs));
  if (replayPhase === 'draining' && !soniox?.hasPendingNonFinalTokens) {
    completeReplay();
  }
},
```

In the `onNonFinalTokens` callback:

```typescript
onNonFinalTokens: (tokens: SonioxToken[]) => {
  lastNonFinalStartMs = tokens.length > 0 ? baseMs + tokens[0].start_ms : null;
  callbacks.onNonFinalTokens(applyTimestampOffset(tokens, baseMs));
  if (replayPhase === 'draining' && tokens.length === 0 && !soniox?.hasPendingNonFinalTokens) {
    completeReplay();
  }
},
```

The drain detection logic: while in `'draining'` phase, check after each token callback whether Soniox has no more pending non-final tokens. After all replay audio is consumed and no new audio is being sent (live audio is buffered), Soniox's endpoint detection will finalize trailing tokens, causing `hasPendingNonFinalTokens` to become `false`. The condition `tokens.length === 0` in the non-final handler avoids triggering on an intermediate batch that happens to report no non-finals while Soniox is still processing.

**Depends on**: Steps 3, 5

### Step 7: Modify `reconnectWithContext()` to accept optional `effectiveReplayStartMs`

**File**: `src/main/soniox-lifecycle.ts`

Change the function signature:

```typescript
export function reconnectWithContext(contextText: string, effectiveReplayStartMs?: number | null): void
```

Restructure the function body:

**A. Compute `connectionBaseMs` based on replay, using `sliceFromWithStart` for accurate chunk alignment:**

```typescript
const needsReplay = effectiveReplayStartMs != null;
let replayAudio: Buffer | null = null;

if (needsReplay) {
  const result = ringBuffer?.sliceFromWithStart(effectiveReplayStartMs) ?? null;
  if (result) {
    replayAudio = result.buffer;
    connectionBaseMs = result.actualStartMs;
    info('Replay: extracted %d bytes from ring buffer at %dms (requested %dms)',
      replayAudio.length, result.actualStartMs, effectiveReplayStartMs);
  } else {
    info('Replay: ring buffer miss at %dms, skipping replay', effectiveReplayStartMs);
    connectionBaseMs = ringBuffer?.currentMs ?? 0;
  }
} else {
  connectionBaseMs = ringBuffer?.currentMs ?? 0;
}
```

Using `result.actualStartMs` for `connectionBaseMs` instead of `effectiveReplayStartMs` ensures token timestamp remapping is accurate even when the requested timestamp falls mid-chunk. The extra audio before `effectiveReplayStartMs` provides additional context to Soniox without misaligning timestamps.

**B. Start buffering and mic capture immediately (before WebSocket connects):**

```typescript
bufferLiveAudio = true;
postResumeLiveBuffer = [];

// Start mic capture immediately — audio goes to local buffer until connection+replay is ready
try {
  startCapture(onAudioData, onAudioError);
} catch (err) {
  error('Failed to start audio capture before reconnect: %s', (err as Error).message);
  bufferLiveAudio = false;
  const errorInfo = classifyAudioError(err as Error);
  callbacks.onStatusChange('error');
  callbacks.onError(errorInfo);
  return;
}
```

This satisfies the spec requirement "Mic capture restarts immediately on resume" — the user hears unpause immediately, and live audio is buffered until the connection is ready.

**C. Modify `onConnected` handler — no longer starts capture (already started above):**

```typescript
onConnected: () => {
  info('Soniox reconnected with fresh context');

  if (replayAudio) {
    // Send replay audio to connection B in chunks matching typical capture size
    const CHUNK_SIZE = 3200; // 100ms at 16kHz/16-bit
    for (let offset = 0; offset < replayAudio.length; offset += CHUNK_SIZE) {
      const end = Math.min(offset + CHUNK_SIZE, replayAudio.length);
      soniox?.sendAudio(replayAudio.subarray(offset, end));
    }
    info('Replay: sent %d bytes to connection B', replayAudio.length);

    replayPhase = 'draining';

    // Fallback timeout: if drain detection via token callbacks doesn't fire
    // within a generous window, complete replay anyway. Soniox endpoint
    // detection is bounded by max_endpoint_delay_ms (typically 1-2s).
    // 5s covers worst-case processing delay + endpoint detection.
    const DRAIN_TIMEOUT_MS = 5000;
    replayDrainTimer = setTimeout(() => {
      replayDrainTimer = null;
      if (replayPhase === 'draining') {
        warn('Replay drain timeout after %dms, forcing completion', DRAIN_TIMEOUT_MS);
        completeReplay();
      }
    }, DRAIN_TIMEOUT_MS);
  } else {
    // No replay — flush any pre-connection buffered audio immediately
    flushLiveBuffer();
  }

  callbacks.onStatusChange('recording');
},
```

**D. Error and disconnect handlers must clean up buffering state.**

In the `onError` handler within the new SonioxClient constructor:

```typescript
onError: (err: Error) => {
  error('Soniox error during context reconnect: %s', err.message);
  stopCapture();
  bufferLiveAudio = false;
  postResumeLiveBuffer = [];
  replayPhase = 'idle';
  if (replayDrainTimer) { clearTimeout(replayDrainTimer); replayDrainTimer = null; }
  callbacks.onAudioLevel?.(MIN_DB);
  callbacks.onStatusChange('error');
  callbacks.onError({ type: 'unknown', message: err.message });
},
```

In `handleDisconnect()` (after the existing `stopCapture()` call), add cleanup:

```typescript
bufferLiveAudio = false;
postResumeLiveBuffer = [];
replayPhase = 'idle';
if (replayDrainTimer) { clearTimeout(replayDrainTimer); replayDrainTimer = null; }
```

**Depends on**: Steps 1, 3, 4, 5, 6

### Step 8: Update `session.ts` to compute `effectiveReplayStartMs`

**File**: `src/main/session.ts`

**A. Update import to include `getPendingStartMs`:**

```typescript
import { ..., getPendingStartMs } from './soniox-lifecycle';
```

**B. Destructure `replayAnalysis` from the resume analysis result.**

Change line 169 from:
```typescript
const { editorWasModified, editorText } = await getResumeAnalysis();
```
To:
```typescript
const { editorWasModified, replayAnalysis, editorText } = await getResumeAnalysis();
```

**C. Modify the `editorWasModified` branch (line ~177) to compute and pass `effectiveReplayStartMs`:**

```typescript
if (editorWasModified) {
  const pendingMs = getPendingStartMs();
  let effectiveReplayStartMs: number | null = null;

  if (replayAnalysis.eligible) {
    effectiveReplayStartMs = pendingMs == null
      ? replayAnalysis.replayStartMs
      : Math.min(replayAnalysis.replayStartMs!, pendingMs);
  } else if (pendingMs != null) {
    effectiveReplayStartMs = pendingMs;
  }

  info('Editor modified during pause, reconnecting with fresh context (%d chars), effectiveReplayStartMs=%s',
    editorText.length, effectiveReplayStartMs);
  reconnectWithContext(editorText, effectiveReplayStartMs);
}
```

This implements the formula from the spec:
- Eligible + no pending: `replayStartMs`
- Eligible + pending: `min(replayStartMs, pendingStartMs)`
- Not eligible + pending: `pendingStartMs` (replay unfinalized audio only)
- Not eligible + no pending: `null` (no replay)

**Depends on**: Step 7

### Step 9: Export `getReplayPhase()` for testability

**File**: `src/main/soniox-lifecycle.ts`

Add a test-oriented getter:

```typescript
export function getReplayPhase(): string {
  return replayPhase;
}
```

**Depends on**: Step 3

### Step 10: Update tests in `soniox-lifecycle.test.ts`

**File**: `src/main/soniox-lifecycle.test.ts`

**A. Update import** to include `getReplayPhase`.

**B. Add a `describe('audio replay')` block** with these test cases:

1. **Replay audio extraction and sending**: Call `reconnectWithContext('text', 2000)` with `mockRingBufferInstance.sliceFromWithStart` returning `{ buffer: Buffer.alloc(6400), actualStartMs: 2000 }` → verify `sendAudio` called with chunked replay data after `triggerOnConnected()`
2. **Ring buffer miss skips replay**: `sliceFromWithStart` returns `null` → verify `flushLiveBuffer` called on connect (live buffer flushed), `connectionBaseMs` set to `ringBuffer.currentMs`
3. **connectionBaseMs uses actualStartMs from ring buffer**: `sliceFromWithStart` returns `{ ..., actualStartMs: 1950 }` when called with `2000` → verify token offset uses `1950`
4. **Live audio buffering during replay**: After `reconnectWithContext` with replay, get `onAudioData` from `startCapture` mock, fire it → verify chunks are NOT sent to `sendAudio` but ARE pushed to ring buffer
5. **Replay drain via `hasPendingNonFinalTokens`**: Set replay in draining phase, set `hasPendingNonFinalTokens = false`, fire `onFinalTokens` → verify buffered live audio is flushed to `sendAudio`
6. **Drain timeout fallback**: With `vi.useFakeTimers()`, enter draining phase → advance timer past 5000ms → verify forced flush and `replayPhase` returns to `'idle'`
7. **No replay path**: `reconnectWithContext('text', null)` → verify immediate flush on connect
8. **Mic capture starts before WebSocket connect**: Verify `startCapture` is called during `reconnectWithContext`, before `triggerOnConnected()`
9. **Error cleanup**: Simulate error during replay → verify buffering state is reset (`bufferLiveAudio = false`, `replayPhase = 'idle'`)

**C. Update existing `reconnectWithContext` tests.** The signature now accepts an optional second argument. Existing tests that call `reconnectWithContext('text')` pass `undefined` implicitly (no replay), preserving existing behavior. However, tests that assert `startCapture` is called inside `onConnected` must be updated — capture now starts before `onConnected`. Specifically:

- Test "starts audio capture on new connection connected event" (line ~739): Change to verify `startCapture` is called in `reconnectWithContext()` before `triggerOnConnected()`
- Adjust any `mockAudio.startCapture.mockClear()` placements that assume capture starts in `onConnected`

**D. Add `sliceFromWithStart` to the mock ring buffer instance:**

```typescript
sliceFromWithStart: vi.fn(),
```

**Depends on**: Steps 1-9

### Step 11: Update tests in `session.test.ts` and `session-reconnect.test.ts`

**File**: `src/main/session.test.ts`, `src/main/session-reconnect.test.ts`

**A. `session.test.ts`**: Add test cases for `effectiveReplayStartMs` computation in `resumeSession()`:

1. **Eligible + no pending**: `replayAnalysis.eligible = true, replayStartMs = 3000, pendingStartMs = null` → `reconnectWithContext(text, 3000)`
2. **Eligible + pending (pending earlier)**: `replayStartMs = 3000, pendingStartMs = 2000` → `reconnectWithContext(text, 2000)`
3. **Eligible + pending (replay earlier)**: `replayStartMs = 1000, pendingStartMs = 2000` → `reconnectWithContext(text, 1000)`
4. **Not eligible + pending**: `eligible = false, pendingStartMs = 2500` → `reconnectWithContext(text, 2500)`
5. **Not eligible + no pending**: `eligible = false, pendingStartMs = null` → `reconnectWithContext(text, null)` (or `undefined`)

Mock `getPendingStartMs` to return the test value. Verify `reconnectWithContext` is called with the correct second argument.

**B. `session-reconnect.test.ts`**: Review existing tests for ordering assumptions about when `startCapture` is called during reconnection. Update any tests that assume capture starts in `onConnected` rather than before it. The behavioral change only applies to `reconnectWithContext` (edit-resume path), not to network-error reconnects via `attemptReconnect()`.

**Depends on**: Steps 8, 10

## Risks / Open Questions

### Replay drain detection reliability

The primary drain signal is `!soniox.hasPendingNonFinalTokens` checked in token callbacks. This works because after replay audio is sent and no new audio follows (live audio is buffered), Soniox's endpoint detection finalizes trailing tokens. However:

- **Silent replay audio**: If the replay audio is pure silence, Soniox may not send any token responses, and `hasPendingNonFinalTokens` stays at its initial `true`. The 5-second timeout fallback handles this.
- **Early triggering**: `hasPendingNonFinalTokens` could briefly become `false` at a word boundary before Soniox finishes processing all replay audio. In practice this is unlikely for short replay audio (2-5 seconds) sent instantly, as Soniox processes faster than real-time. A future improvement could track `final_audio_proc_ms` from Soniox responses for more precise detection.

### Renderer-side dependency

The full replay flow requires a companion renderer-side task to convert the eligible clean tail into a replay ghost region before replay tokens arrive. Without that task, replay tokens flow through the normal `onFinalTokens` callback and get committed via `TokenCommitPlugin` at the document tail — they would appear as appended text rather than replacing the eligible region. The audio pipeline implemented here is correct regardless; the renderer task adds the visual/editor side.

### `startCapture()` throws if already active

The modified `reconnectWithContext()` calls `startCapture()` before the WebSocket connects. If a previous capture wasn't stopped (bug in pause flow), this throws. The error is caught and reported, consistent with existing error handling patterns. This risk exists in the current code too.

### Existing test ordering changes

Several tests in `soniox-lifecycle.test.ts` and `session-reconnect.test.ts` assume `startCapture` is called inside `onConnected`. After this change, `startCapture` is called in `reconnectWithContext()` before `onConnected` for the edit-resume path. Tests need careful adjustment to reflect the new ordering without breaking the `connectSoniox()` and `attemptReconnect()` paths (which keep the existing `onConnected`-based capture start).
