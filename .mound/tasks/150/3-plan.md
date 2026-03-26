# Plan — Task 150: Track connectionBaseMs and offset Soniox token timestamps

## Goal

Introduce `connectionBaseMs` in the Soniox lifecycle module and offset all incoming token timestamps by it, so that `TimestampedTextNode` timestamps are always in session audio time rather than per-connection time.

## Steps

### Step 1: Update `spec/models.md` — clarify `SonioxToken` timestamp semantics

**File:** `spec/models.md`

Update the `SonioxToken` description (line 5) as specified in `2-spec-updates.md`. Change:

> A single token received from the Soniox WebSocket API.

To a paragraph that distinguishes connection-relative timestamps (inside `SonioxClient`) from session-relative timestamps (after lifecycle offsetting). See `2-spec-updates.md` for exact wording.

No other spec files need changes.

### Step 2: Add `connectionBaseMs` state variable to `soniox-lifecycle.ts`

**File:** `src/main/soniox-lifecycle.ts`

Add a module-level variable alongside the existing state (near line 27, after `awaitingFinalization`):

```ts
let connectionBaseMs = 0;
```

This follows the existing pattern of module-level `let` variables (`soniox`, `reconnectTimer`, `reconnectAttempt`, `storedContextText`, etc.).

### Step 3: Implement `applyTimestampOffset` helper function

**File:** `src/main/soniox-lifecycle.ts`

Add a module-private helper function near the top of the file (after imports, before exported functions — following the existing pattern of `flushSoundEvent()`):

```ts
function applyTimestampOffset(tokens: SonioxToken[], offsetMs: number): SonioxToken[] {
  if (offsetMs === 0) return tokens;
  return tokens.map(t => ({
    ...t,
    start_ms: t.start_ms + offsetMs,
    end_ms: t.end_ms + offsetMs,
  }));
}
```

The `offsetMs === 0` short-circuit avoids unnecessary allocation for the initial connection (which always has `connectionBaseMs = 0`), preserving identical behavior for the existing flow.

### Step 4: Apply offset in lifecycle token callbacks

**File:** `src/main/soniox-lifecycle.ts`

Modify the `SonioxClient` callback wiring in **both** `connectSoniox()` and `attemptReconnect()` to offset tokens before forwarding.

**In `connectSoniox()` (lines 198–203):**

```ts
onFinalTokens: (tokens: SonioxToken[]) => {
  callbacks.onFinalTokens(applyTimestampOffset(tokens, connectionBaseMs));
},
onNonFinalTokens: (tokens: SonioxToken[]) => {
  callbacks.onNonFinalTokens(applyTimestampOffset(tokens, connectionBaseMs));
},
```

**In `attemptReconnect()` (lines 240–245):**

```ts
onFinalTokens: (tokens: SonioxToken[]) => {
  callbacks.onFinalTokens(applyTimestampOffset(tokens, connectionBaseMs));
},
onNonFinalTokens: (tokens: SonioxToken[]) => {
  callbacks.onNonFinalTokens(applyTimestampOffset(tokens, connectionBaseMs));
},
```

**Depends on:** Steps 2 and 3.

### Step 5: Reset `connectionBaseMs` in `resetLifecycle()`

**File:** `src/main/soniox-lifecycle.ts`

In `resetLifecycle()`, add `connectionBaseMs = 0;` alongside the existing resets. This ensures each new session starts with a clean baseline.

### Step 6: Add unit tests

**File:** `src/main/soniox-lifecycle.test.ts`

Add a new `describe('connectionBaseMs')` block with the following tests. To test non-zero offset values, the tests need to set `connectionBaseMs` — but the variable is internal. Use a **test-only backdoor**: the test file can reach `connectionBaseMs` by directly modifying the module state. However, since module-level variables aren't directly importable, the pragmatic approach is to **temporarily export a setter in the test setup**, or more simply: **use the existing `connectSoniox` API and simulate the scenario where `connectionBaseMs` would be non-zero**.

The cleanest approach for this task: export only a `getConnectionBaseMs()` getter (for tests and for downstream task 152 which reads it) and keep `connectionBaseMs` settable only through a new optional parameter on `connectSoniox()`.

**Actually, the simplest approach:** Since task 150 only needs `connectionBaseMs = 0` for the initial connection, and the offset logic is a no-op at 0, the unit tests should:

1. **Verify the offset function works correctly** — test `applyTimestampOffset` directly by exporting it as a named export (it's a pure function, safe to export).
2. **Verify the lifecycle integration** — confirm tokens flow through with offset 0 (this is already implicitly tested by existing tests that check `callbacks.onFinalTokens` is called with the original tokens).

For testing non-zero offsets (which will matter for task 152), export the pure `applyTimestampOffset` function:

```ts
export function applyTimestampOffset(tokens: SonioxToken[], offsetMs: number): SonioxToken[]
```

Tests:

1. **`applyTimestampOffset` returns tokens unchanged when offsetMs is 0**: Pass tokens with `start_ms: 100, end_ms: 200`, verify output is the same array reference.
2. **`applyTimestampOffset` offsets timestamps correctly**: Pass `offsetMs: 5000`, verify `start_ms` becomes 5100 and `end_ms` becomes 5200.
3. **`applyTimestampOffset` preserves other token fields**: Verify `text`, `confidence`, `is_final`, `speaker` are unchanged.
4. **Initial connection tokens pass through unchanged**: Connect with default state, trigger `onFinalTokens` with `{ start_ms: 100, end_ms: 200 }`, verify callback receives same values. (This confirms the lifecycle wiring applies the offset — at 0, it's a no-op pass-through.)
5. **`resetLifecycle` resets connectionBaseMs**: Import `getConnectionBaseMs`, verify it returns 0 after reset.

### Step 7: Verify no regression

Run the full relevant test suite:

```bash
npx vitest run src/main/soniox-lifecycle.test.ts src/main/session.test.ts
```

Since `connectionBaseMs` starts at 0 and `applyTimestampOffset` short-circuits at 0 (returning the original array), all existing tests should pass unchanged. Running `session.test.ts` as well confirms the IPC forwarding layer is unaffected.

## Risks / Open Questions

1. **Mutation vs. copy**: The plan creates new token objects via spread+map when `offsetMs !== 0`. This is correct because tokens flow through IPC serialization anyway, so a shallow copy has negligible cost. Direct mutation would be dangerous because `SonioxClient` may retain references. The `offsetMs === 0` short-circuit avoids copies for the common initial-connection case.

2. **Two callback sites**: Both `connectSoniox()` and `attemptReconnect()` create `SonioxClient` instances with their own callbacks. The offset must be applied in both places. An alternative would be to extract a shared callback factory, but this adds unnecessary abstraction for now — the duplication is minimal (two identical one-liners per callback) and matches the existing code structure where these two functions both inline their callback objects.

3. **Setting `connectionBaseMs` for future tasks**: This task does NOT export a setter for `connectionBaseMs`. The variable remains module-internal. Task 152 (connection handoff) will introduce the mechanism for setting it (likely as a parameter to a new `reconnectWithContext()` function or similar). Deferring the setter avoids premature API design — task 152 has the full context of how the value should be set and can design the right API at that time.

4. **`applyTimestampOffset` export**: Exporting this pure function is safe — it has no side effects and enables thorough unit testing. It could also be useful for task 152 or 154 if they need to apply offsets in other contexts.

5. **Non-final token offset**: Non-final tokens are currently only used for ghost text display (text only, no timestamps used in rendering). However, offsetting them is correct for consistency and for any future consumer that might use non-final timestamps (e.g., for replay ghost region positioning).

6. **`getConnectionBaseMs` export**: A minimal getter is exported for testing and for downstream tasks that need to read the current offset. It has no side effects and doesn't widen the mutation surface.
