# Plan

## Goal

Add a flush timeout to `TokenCommitPlugin` so that when no new final tokens arrive within 300ms, the pending buffer is flushed and the last word appears in the editor without requiring additional speech input.

## Steps

### Step 1: Update the silence edge case in `spec/features/realtime-transcription.md`

Update line 38 to describe the timeout-based flush for the buffered final word. See `2-spec-updates.md` for exact text.

### Step 2: Add flush timeout constant and logic to `TokenCommitPlugin.tsx`

**File**: `src/renderer/overlay/editor/TokenCommitPlugin.tsx`

**a) Add a named constant** at module level (after imports):

```typescript
/** Delay before flushing the pending token buffer after the last final-token batch.
 *  Must be longer than the typical gap between consecutive Soniox responses
 *  (~100-200ms during active speech) to avoid flushing mid-word. */
const PENDING_FLUSH_TIMEOUT_MS = 300;
```

**b) Add a `flushTimerRef`** alongside the existing `pendingRef` (line 31):

```typescript
const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

**c) In the `onTokensFinal` handler** (the `useEffect` starting at line 192): after updating `pendingRef.current` and committing words, start/reset a flush timer if there are pending tokens:

```typescript
// Clear any existing flush timer
if (flushTimerRef.current) {
  clearTimeout(flushTimerRef.current);
  flushTimerRef.current = null;
}

// Start flush timer if there are pending tokens
if (newPending.length > 0) {
  flushTimerRef.current = setTimeout(() => {
    flushTimerRef.current = null;
    const flushed = flushPending(pendingRef.current);
    pendingRef.current = [];
    if (flushed) {
      commitWords([flushed]);
    }
  }, PENDING_FLUSH_TIMEOUT_MS);
}
```

**d) In the session pause/stop flush handler** (the `useEffect` starting at line 207): clear the flush timer at the start of `flush()`, since the explicit flush supersedes the timeout:

```typescript
function flush() {
  if (flushTimerRef.current) {
    clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
  }
  // ... existing flush logic unchanged
}
```

**e) In the replay ghost convert handler** (the `useEffect` starting at line 226): clear the flush timer before the `flushPending` call (around line 255):

```typescript
if (flushTimerRef.current) {
  clearTimeout(flushTimerRef.current);
  flushTimerRef.current = null;
}
```

**f) In the clear hook** (the `useEffect` starting at line 55 that resets `pendingRef`): clear the flush timer too:

```typescript
return registerClearHook(() => {
  if (flushTimerRef.current) {
    clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
  }
  pendingRef.current = [];
});
```

**g) Add a cleanup effect** to clear the timer on unmount:

```typescript
useEffect(() => {
  return () => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
    }
  };
}, []);
```

### Step 3: Add test for the flush-after-silence scenario in `tokenMerger.test.ts`

**File**: `src/renderer/overlay/editor/tokenMerger.test.ts`

Add a test case in the `mergeTokens` describe block that documents the end-to-end scenario: a full utterance arrives, the last word is buffered, and `flushPending` emits it. This is the unit-level verification of the merge+flush contract that the timeout relies on:

```typescript
it('simulates final-word-after-pause: merge buffers last word, flush emits it', () => {
  const r = mergeTokens([], [
    tok(' hello', 100, 200),
    tok(' this', 300, 400),
    tok(' is', 500, 550),
    tok(' a', 600, 650),
    tok(' transcription', 700, 900),
  ]);
  expect(r.words).toHaveLength(4);
  expect(r.words.map(w => w.text)).toEqual([' hello', ' this', ' is', ' a']);
  expect(r.newPending).toEqual([tok(' transcription', 700, 900)]);

  const flushed = flushPending(r.newPending);
  expect(flushed).toEqual({
    text: ' transcription',
    startMs: 700,
    endMs: 900,
    originalText: ' transcription',
  });
});
```

Note: The timer orchestration in `TokenCommitPlugin` is React component logic that would require a full Lexical editor test harness to test at the component level. No existing component tests exist for `TokenCommitPlugin`. The unit test above verifies the merge/flush contract the timer depends on.

## Risks / Open Questions

1. **Timer vs. endpoint marker approach**: The reviewer suggested using Soniox `<end>` endpoint markers instead of a timer. The timer approach was chosen because: (a) it's self-contained in the renderer with no new IPC channels/events needed, (b) it doesn't depend on assumptions about Soniox's exact endpoint marker timing relative to final tokens, (c) it's simpler to implement and debug. The `<end>` marker approach would require changes across 5+ files (soniox.ts, soniox-lifecycle.ts, session.ts, ipc.ts, preload, TokenCommitPlugin) for a single bug fix. The endpoint marker approach could be considered as a future refinement if the timer proves insufficient.

2. **Timeout value (300ms)**: Must be longer than the gap between consecutive Soniox responses during active speech (~100-200ms) to avoid flushing mid-word. The 300ms value provides a comfortable margin. Total delay from speech pause to last word visible: Soniox endpoint delay (default 1000ms) + 300ms ≈ 1.3s, well within the spec's "text appears within 500ms of speaking" goal (which measures speaking-to-display latency, not pause-to-final-word latency).

3. **Split-word risk**: If the timer fires and flushes a word, then a continuation token arrives, we'd get separate text nodes. This is extremely unlikely because: (a) sub-word tokens arrive in the same Soniox response, (b) a 300ms gap means Soniox has fully processed that audio segment, (c) Soniox's own endpoint detection already triggered before our timer would fire.

4. **Component-level testing gap**: No existing test infrastructure for `TokenCommitPlugin`. Adding one would require mocking `window.api`, Lexical editor, `useLexicalComposerContext`, and block manager — disproportionate effort for this fix.
