# Plan — Task 153: Capture pendingStartMs at pause time

## Goal

Track the `start_ms` of the first unfinalized (non-final) token at pause time, persist it as `pendingStartMs` in session audio time, and expose it for the resume-time replay start calculation.

## Steps

### Step 1: Add state variables to `soniox-lifecycle.ts`

**File:** `src/main/soniox-lifecycle.ts`

Add two module-level state variables alongside the existing ones (near line 29, after `ringBuffer`):

```ts
let lastNonFinalStartMs: number | null = null;
let pendingStartMs: number | null = null;
```

- `lastNonFinalStartMs`: Live state, updated every time `onNonFinalTokens` fires. Stores the `start_ms` of the first token in the most recent non-final batch, in **connection-relative** time (raw from Soniox). Cleared when final tokens arrive and no non-finals remain. This is a transient tracking variable, not exposed outside the module.
- `pendingStartMs`: A **frozen snapshot** captured at pause time from `lastNonFinalStartMs` (converted to session audio time). Once captured, it is NOT cleared by late-arriving final tokens — it persists until session reset or explicit clearing at resume (future task). This design matches the spec: even if finalization succeeds during pause, the committed tokens used the old context and may need replay with corrected context.

### Step 2: Update non-final token callbacks to track `lastNonFinalStartMs`

**File:** `src/main/soniox-lifecycle.ts`

Modify the `onNonFinalTokens` callback in **both** `connectSoniox()` (line ~208) and `attemptReconnect()` (line ~249) to capture the first token's `start_ms` before forwarding:

```ts
onNonFinalTokens: (tokens: SonioxToken[]) => {
  lastNonFinalStartMs = tokens.length > 0 ? tokens[0].start_ms : null;
  callbacks.onNonFinalTokens(tokens);
},
```

When `SonioxClient` sends an empty `onNonFinalTokens([])` (which happens when all tokens are protocol markers), set `lastNonFinalStartMs = null`. This correctly reflects "no pending non-final tokens."

Also update the `onFinalTokens` callback to clear `lastNonFinalStartMs` (the live tracker) when final tokens arrive and no non-finals remain. This does NOT clear `pendingStartMs`:

```ts
onFinalTokens: (tokens: SonioxToken[]) => {
  if (!soniox?.hasPendingNonFinalTokens) {
    lastNonFinalStartMs = null;
  }
  callbacks.onFinalTokens(tokens);
},
```

**Depends on:** Step 1.

### Step 3: Add `capturePendingStartMs()` function

**File:** `src/main/soniox-lifecycle.ts`

Add a new exported function that snapshots the current non-final start time as `pendingStartMs` in session audio time:

```ts
export function capturePendingStartMs(): void {
  if (lastNonFinalStartMs != null) {
    pendingStartMs = connectionBaseMs + lastNonFinalStartMs;
    debug('Captured pendingStartMs=%d (connectionBaseMs=%d + lastNonFinalStartMs=%d)',
      pendingStartMs, connectionBaseMs, lastNonFinalStartMs);
  } else {
    pendingStartMs = null;
    debug('No pending non-final tokens at capture time');
  }
}
```

This reads `connectionBaseMs` (introduced by task 150). For the initial connection, `connectionBaseMs` is always 0, so `pendingStartMs` equals `lastNonFinalStartMs` — correct even before task 150 lands.

**Task 150 coordination:** Task 150 adds `let connectionBaseMs = 0;` as a module-level variable in the same file. If task 150 has not been merged when this task is implemented, the implementer should add that same variable declaration. If both tasks add it independently, the merge conflict is trivial (adjacent `let` declarations). The implementer should NOT introduce a separate fallback variable — use the canonical name `connectionBaseMs`.

**Depends on:** Steps 1, 2.

### Step 4: Add `getPendingStartMs()` getter

**File:** `src/main/soniox-lifecycle.ts`

Export a getter so `session.ts` (and tests) can read the captured value:

```ts
export function getPendingStartMs(): number | null {
  return pendingStartMs;
}
```

**Depends on:** Step 1.

### Step 5: Reset state in `resetLifecycle()`

**File:** `src/main/soniox-lifecycle.ts`

Add resets for both new variables in `resetLifecycle()` (alongside existing resets near line 73):

```ts
lastNonFinalStartMs = null;
pendingStartMs = null;
```

**Depends on:** Step 1.

### Step 6: Call `capturePendingStartMs()` from `pauseSession()`

**File:** `src/main/session.ts`

Import `capturePendingStartMs` and `getPendingStartMs` from `soniox-lifecycle` and call `capturePendingStartMs()` during the pause flow, **after** stopping capture but **before** finalization:

```ts
import { ..., capturePendingStartMs, getPendingStartMs } from './soniox-lifecycle';

async function pauseSession(): Promise<void> {
  if (status !== 'recording') return;
  info('Session pausing');

  status = 'paused';

  stopCapture();
  sendToRenderer(IpcChannels.AUDIO_LEVEL, MIN_DB);

  // Snapshot the start time of any unfinalized tokens before finalization
  // attempts to drain them. This is a frozen snapshot — even if finalization
  // succeeds, the committed tokens used old context and may need replay.
  capturePendingStartMs();

  if (isConnected() && hasPendingNonFinalTokens()) {
    finalizeSoniox();
    await waitForFinalization();
  }

  sendToRenderer(IpcChannels.TOKENS_NONFINAL, []);
  sendToRenderer(IpcChannels.SESSION_PAUSED);
  sendStatus(status);
}
```

The capture happens before `finalizeSoniox()` because finalization may cause `lastNonFinalStartMs` to be cleared by incoming final tokens. Capturing first ensures the snapshot is taken while the non-final state is still available.

**Depends on:** Steps 3, 4.

### Step 7: Add unit tests for `soniox-lifecycle.ts`

**File:** `src/main/soniox-lifecycle.test.ts`

Add a new `describe('pendingStartMs')` block. Import `capturePendingStartMs` and `getPendingStartMs` alongside the existing imports (line ~91).

Tests:

1. **Captures first non-final token's start_ms**: Connect, trigger `onNonFinalTokens` with `[{ text: 'hel', start_ms: 500, end_ms: 600, confidence: 0.9, is_final: false }]`. Call `capturePendingStartMs()`, verify `getPendingStartMs()` returns 500.

2. **Returns null when no non-final tokens exist**: Connect, trigger `onNonFinalTokens([])`. Call `capturePendingStartMs()`, verify `getPendingStartMs()` returns null.

3. **Returns null when no tokens ever received**: Connect, call `capturePendingStartMs()` immediately, verify `getPendingStartMs()` returns null.

4. **Final tokens clear lastNonFinalStartMs but NOT pendingStartMs**: Connect, trigger `onNonFinalTokens` (sets live state), call `capturePendingStartMs()` (snapshot = 500). Set `mockSonioxInstance.hasPendingNonFinalTokens = false`, trigger `onFinalTokens`. Verify `getPendingStartMs()` still returns 500.

5. **pendingStartMs persists across finalization**: Connect, trigger non-finals, capture. Trigger finalization cycle (finals arrive, non-finals drain). Verify `getPendingStartMs()` is still the original captured value.

6. **Captures most recent non-final start**: Trigger non-finals with `start_ms: 100`, then trigger non-finals with `start_ms: 200`. Call `capturePendingStartMs()`. Verify `getPendingStartMs()` returns 200.

7. **resetLifecycle clears pendingStartMs**: Connect, capture pendingStartMs. Call `resetLifecycle()`. Verify `getPendingStartMs()` returns null.

8. **Uses first token's start_ms from multi-token batch**: Trigger non-finals with `[{ start_ms: 300 }, { start_ms: 400 }]`. Capture. Verify returns 300 (first token).

**Depends on:** Steps 1–5.

### Step 8: Add integration tests in `session.test.ts`

**File:** `src/main/session.test.ts`

The session test file uses the **real** `soniox-lifecycle` module (with mocked SonioxClient and audio underneath). This means we can test the capture integration by checking observable state via `getPendingStartMs()`.

Import `getPendingStartMs` from `./soniox-lifecycle` at the top of the test file.

Add tests in the existing `describe('pause')` block:

1. **Captures pendingStartMs on pause when non-final tokens exist**: Start a session, trigger connected, trigger `onNonFinalTokens` on the mock Soniox instance (which flows through the real lifecycle). Then trigger pause. After pause completes, verify `getPendingStartMs()` returns the expected value.

2. **pendingStartMs is null on pause when no non-final tokens**: Start a session, trigger connected. Set `mockSonioxInstance.hasPendingNonFinalTokens = false`. Trigger pause. Verify `getPendingStartMs()` returns null.

3. **pendingStartMs survives finalization during pause**: Start a session, trigger non-final tokens, trigger pause (which triggers finalization). During finalization, trigger final tokens that clear non-final state. After pause completes, verify `getPendingStartMs()` is still the original captured value (frozen snapshot).

Since session.test.ts uses the real lifecycle, these tests verify the full integration: session calls `capturePendingStartMs()` at the right time, lifecycle captures correctly, and the value persists.

**Depends on:** Steps 6, 7.

### Step 9: Run tests and verify

Run the full test suite for both files:

```bash
npx vitest run src/main/soniox-lifecycle.test.ts src/main/session.test.ts
```

Verify all existing tests pass unchanged and all new tests pass.

**Depends on:** Steps 7, 8.

## Risks / Open Questions

1. **Task 150 dependency (connectionBaseMs)**: Task 150 adds `connectionBaseMs` to the same file. If task 153 lands first, it should add `let connectionBaseMs = 0;` using the canonical name. If task 150 lands first, task 153 just references the existing variable. The merge conflict is trivial. For the initial connection, `connectionBaseMs = 0`, so `pendingStartMs = 0 + lastNonFinalStartMs = lastNonFinalStartMs` — correct regardless of merge order.

2. **Frozen snapshot semantics**: `pendingStartMs` is intentionally NOT cleared by late-arriving final tokens. Even though finalization may commit the pending tokens, those committed tokens used the old context and may need replay with corrected context at resume. The spec says "Main captures `pendingStartMs` at pause time ... and persists it across the handoff." The resume-time decision about whether replay is actually needed is made by the `effectiveReplayStartMs` calculation (which considers re-transcription eligibility).

3. **Resume-time consumption**: The task description's acceptance criterion "Value is used in the effective replay start calculation at resume time" is satisfied by exposing `getPendingStartMs()` for the resume flow to consume. The actual `effectiveReplayStartMs` calculation in `session.ts` requires infrastructure not yet built (renderer replay analysis, connection handoff). That wiring will be part of a future task. This task ensures the value is captured, persisted, and accessible.

4. **Non-final token ordering**: The plan uses `tokens[0].start_ms` as the "first" non-final token. Soniox returns tokens in temporal order within a message, so `tokens[0]` is the earliest.

5. **Two callback sites**: Both `connectSoniox()` and `attemptReconnect()` create `SonioxClient` instances with their own callbacks. The `lastNonFinalStartMs` tracking must be applied in both. This matches the existing pattern where both functions inline their callback objects.

6. **`pendingStartMs` clearing at resume**: This task does not add a mechanism to clear `pendingStartMs` at resume time. That will be the responsibility of the connection handoff task, which reads the value and then clears it after the replay decision is made. `resetLifecycle()` (session end) is the only clearing mechanism in this task's scope.
