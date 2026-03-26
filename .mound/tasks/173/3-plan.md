# Plan

## Goal

Add a 3-second zero-token timeout to the replay drain phase so that silence-only replay audio completes quickly instead of waiting for the full 10-second safety timeout.

## Steps

### Step 1: Add constant and timer variable in `src/main/soniox-lifecycle.ts`

Add a new constant near the existing `REPLAY_DRAIN_TIMEOUT_MS` (line 129):

```typescript
const REPLAY_ZERO_TOKEN_TIMEOUT_MS = 3000;
```

Add a new module-level variable near the existing `replayDrainTimer` (line 36):

```typescript
let replayZeroTokenTimer: ReturnType<typeof setTimeout> | null = null;
```

No flag variable needed — the timer itself is cleared when tokens arrive (see Step 3).

### Step 2: Start zero-token timer in `sendReplayAudio`

In `sendReplayAudio()`, after the existing drain safety timeout setup (lines 156-163), add:

```typescript
// Zero-token fast path: if no final tokens arrive within 3s, assume silence-only replay
if (replayZeroTokenTimer) clearTimeout(replayZeroTokenTimer);
replayZeroTokenTimer = setTimeout(() => {
  replayZeroTokenTimer = null;
  if (replayPhase === 'draining') {
    info('Zero tokens received after %dms — ending replay phase (silence-only)', REPLAY_ZERO_TOKEN_TIMEOUT_MS);
    endReplayPhase();
  }
}, REPLAY_ZERO_TOKEN_TIMEOUT_MS);
```

### Step 3: Cancel zero-token timer when final tokens arrive during drain

In the `onFinalTokens` handler inside `reconnectWithContext()` (line 418), when tokens arrive during drain, clear the zero-token timer so only the normal drain heuristic and 10s safety timeout remain:

```typescript
if (replayPhase === 'draining' && tokens.length > 0) {
  // Cancel zero-token fast path — tokens arrived, use normal drain heuristic
  if (replayZeroTokenTimer) {
    clearTimeout(replayZeroTokenTimer);
    replayZeroTokenTimer = null;
  }
  // ... existing drain detection heuristic unchanged
}
```

### Step 4: Clean up zero-token timer in `endReplayPhase`

In `endReplayPhase()` (line 110), add cleanup for the zero-token timer alongside the existing `replayDrainTimer` cleanup:

```typescript
if (replayZeroTokenTimer) {
  clearTimeout(replayZeroTokenTimer);
  replayZeroTokenTimer = null;
}
```

### Step 5: Clean up zero-token timer in `resetLifecycle`

In `resetLifecycle()` (line 166), add cleanup alongside the existing `replayDrainTimer` cleanup:

```typescript
if (replayZeroTokenTimer) {
  clearTimeout(replayZeroTokenTimer);
  replayZeroTokenTimer = null;
}
```

### Step 6: Update spec

In `spec/proposal-context-refresh.md`, at the end of the replay draining paragraph (line ~227), add:

> If no final tokens are received within 3 seconds of entering the drain phase, the replay is considered complete immediately — this handles the case where replay audio contains only silence and Soniox produces no tokens. The 10-second safety timeout remains as the ultimate fallback whenever replay draining has not completed by any other mechanism.

### Step 7: Add tests in `src/main/soniox-lifecycle.test.ts`

Extend the hoisted mock to include `sliceFromWithMeta` on `mockRingBufferInstance`. Add a `describe('replay drain — zero-token timeout')` block. All tests use the full reconnect flow: `connectSoniox()` → `beginReplayPhase()` → `reconnectWithContext(..., { onReady: () => sendReplayAudio(...) })` → trigger `onConnected` to set up the client — then drive `onFinalTokens` on that client.

Tests:

1. **Zero-token timeout ends replay phase after 3 seconds**: Set up `sliceFromWithMeta` to return audio data, go through the reconnect flow, advance timers by 3000ms, verify `isInReplayPhase()` returns false.

2. **Zero-token timeout does not fire when final tokens arrive**: Set up replay via reconnect flow, trigger `onFinalTokens` with tokens whose `end_ms` is below threshold (not enough to trigger drain heuristic), advance timers by 3000ms, verify `isInReplayPhase()` still returns true (zero-token timer was cancelled, waiting for normal drain or 10s timeout).

3. **Normal drain heuristic still works when tokens arrive**: Set up replay via reconnect flow, trigger `onFinalTokens` with tokens whose `end_ms >= replayEndRelativeMs - 50`, verify `isInReplayPhase()` returns false immediately (no timer advancement needed).

4. **10-second safety timeout still works as ultimate fallback**: Set up replay via reconnect flow, trigger `onFinalTokens` with tokens that don't reach the threshold, advance timers past 10000ms, verify replay phase ends.

## Risks / Open Questions

- **Task 172 overlap**: Task 172 adds comprehensive replay test infrastructure. This task adds the minimal `sliceFromWithMeta` mock extension needed for zero-token tests. If task 172 runs concurrently, there could be merge conflicts in the test file's mock setup. Risk is low since we're adding, not modifying.

- **Timer interaction**: The zero-token timer (3s) and drain safety timer (10s) are independent. For silence-only cases, the zero-token timer fires first at 3s. When tokens arrive, the zero-token timer is cleared directly (no flag needed), and the 10s timer remains as the only fallback. Both timers are cleaned up in `endReplayPhase()`. No race conditions because everything runs on the main thread event loop.
