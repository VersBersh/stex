# Plan — Task 68: Decompose session.ts

## Goal

Extract reconnect policy and error classification from `session.ts` into focused modules, reducing the file's responsibility count without changing behavior.

## Steps

### Step 1: Create `src/main/error-classification.ts`

Create a new module containing the two classification functions extracted from `session.ts`:

```typescript
import type { ErrorInfo } from '../shared/types';

export function classifyAudioError(err: Error): ErrorInfo { ... }

export function classifyDisconnect(code: number, reason: string): { reconnectable: boolean; error: ErrorInfo } { ... }
```

Copy the exact implementations from `session.ts` lines 93-143:
- `classifyAudioError` — maps audio error messages to `ErrorInfo` types (`mic-denied`, `mic-unavailable`, `unknown`).
- `classifyDisconnect` — maps WebSocket disconnect reason strings to `{ reconnectable, error }` with types (`api-key`, `rate-limit`, `network`).

No dependencies beyond `ErrorInfo` from `shared/types.ts`.

### Step 2: Create `src/main/reconnect-policy.ts`

Create a new module with a single pure function and private constants:

```typescript
const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const MULTIPLIER = 2;

export function getReconnectDelay(attempt: number): number {
  return Math.min(INITIAL_DELAY_MS * Math.pow(MULTIPLIER, attempt), MAX_DELAY_MS);
}
```

This extracts the delay calculation from `scheduleReconnect()` (session.ts line 170-173) and the three constants (`RECONNECT_INITIAL_MS`, `RECONNECT_MAX_MS`, `RECONNECT_MULTIPLIER`) from lines 11-13.

The reconnect *state* (`reconnectTimer`, `reconnectAttempt`) and *scheduling* (`scheduleReconnect`, `cancelReconnect`, `attemptReconnect`) remain in `session.ts` because they are tightly coupled to session state transitions and Soniox lifecycle. Only the pure calculation is extracted.

### Step 3: Update `session.ts` to import from new modules

Modify `session.ts`:

1. **Add imports**:
   ```typescript
   import { classifyAudioError, classifyDisconnect } from './error-classification';
   import { getReconnectDelay } from './reconnect-policy';
   ```

2. **Remove** the `classifyAudioError` and `classifyDisconnect` function definitions (lines 93-143).

3. **Remove** the three reconnect constants (lines 11-13):
   ```typescript
   // DELETE:
   const RECONNECT_INITIAL_MS = 1000;
   const RECONNECT_MAX_MS = 30000;
   const RECONNECT_MULTIPLIER = 2;
   ```

4. **Update `scheduleReconnect()`** to use `getReconnectDelay`:
   ```typescript
   function scheduleReconnect(): void {
     if (reconnectTimer) return;

     const delay = getReconnectDelay(reconnectAttempt);
     reconnectAttempt++;

     status = 'reconnecting';
     sendStatus();

     reconnectTimer = setTimeout(() => {
       reconnectTimer = null;
       attemptReconnect();
     }, delay);
   }
   ```

No other changes needed — `classifyAudioError` and `classifyDisconnect` are already called as plain function calls in `session.ts`.

### Step 4: Write unit tests for new modules

- `src/main/error-classification.test.ts` — Tests for `classifyAudioError` and `classifyDisconnect` covering all branches (mic-denied, mic-unavailable, unknown; api-key, rate-limit, network).
- `src/main/reconnect-policy.test.ts` — Tests for `getReconnectDelay` covering initial delay, exponential growth, and max cap.

These test the extracted logic in isolation. Existing integration tests in `session.test.ts` and `session-reconnect.test.ts` verify the wiring is preserved unchanged.

## Risks / Open Questions

- **Risk: test isolation** — The new unit tests import from `error-classification.ts` and `reconnect-policy.ts` directly. These are pure functions with no side effects, so no mocking needed.
- **Risk: import path changes could break existing tests** — Existing tests mock `./session` not the extracted modules, so they are unaffected. The extracted functions are internal to session.ts's implementation; tests verify behavior through `requestToggle` and `initSessionManager`.
- **Minimal extraction scope** — We intentionally keep reconnect *state management* in `session.ts` (timer, attempt counter, scheduling logic) because it's tightly coupled to session state. Only the pure delay calculation is extracted. This is a deliberate trade-off for simplicity.
- **Reviewer concern about "internal" modules having tests** — The 1-context.md note that modules are "internal to session.ts" means existing test files don't import them directly — it's not a constraint against having unit tests. Direct tests for pure extracted functions are standard practice.
