# Plan

## Goal

Remove the dead `disconnected` status value from the `SessionState.status` type union, UI map, handler, specs, test name, and comments — since no runtime path produces it.

## Steps

### 1. Remove `disconnected` from type union in `src/shared/types.ts`

**Line 38:** Remove `"disconnected" |` from the `SessionState.status` union type.

**Before:** `status: "idle" | "connecting" | "recording" | "paused" | "finalizing" | "error" | "disconnected" | "reconnecting";`
**After:** `status: "idle" | "connecting" | "recording" | "paused" | "finalizing" | "error" | "reconnecting";`

### 2. Remove `disconnected` entry from `STATUS_TEXT` in `src/renderer/overlay/components/StatusBar.tsx`

**Line 10:** Delete the `disconnected: 'Disconnected',` entry from the `STATUS_TEXT` record.

### 3. Remove `disconnected` check from `onDismissError` in `src/main/session.ts`

**Line 203:** Change `if (status === 'error' || status === 'disconnected')` to `if (status === 'error')`.

### 4. Update comment in `src/renderer/overlay/OverlayContext.tsx`

**Line 96:** Change `// No-op in other states (disconnected, reconnecting, error, etc.)` to `// No-op in other states (reconnecting, error, etc.)`.

### 5. Fix test name and comment in `src/main/session-reconnect.test.ts`

**Line 476:** Change test name from `'pause is a no-op during disconnected state'` to `'pause is a no-op during reconnecting state'` — `triggerOnDisconnected(1006, ...)` transitions to `reconnecting`, not `disconnected`.

**Line 489:** Change comment from `// Advance to reconnecting` to `// Advance past reconnect delay` — status is already `reconnecting` at this point; the timer advances past the delay to trigger `attemptReconnect()`.

### 6. Update spec: `spec/models.md`

**Line 95:** Remove `"disconnected" |` from the `SessionState.status` union.

### 7. Update spec: `spec/architecture.md`

**Line 124:** Remove `, \`disconnected\`` from the `session:status` values list.

### 8. Update spec: `spec/api.md`

**Line 127:** Rewrite the WebSocket disconnect handling row to match the actual runtime behavior. The current spec says 'Show "Disconnected"' then 'Show "Reconnecting..."' then 'Show "Reconnected"'. The actual behavior is: status goes directly to `reconnecting` (shown as "Reconnecting..."), and after successful reconnect status becomes `paused` (shown as "Paused").

**Before:** `Stop mic capture immediately. Show "Disconnected" in status bar. Auto-reconnect with exponential backoff (1s, 2s, 4s, max 30s) — show "Reconnecting..." during attempts. **Do not buffer audio** during disconnect. Once reconnected, show "Reconnected" and wait for user to resume (click Resume or press \`Ctrl+P\`). Some audio will be lost during the outage — this is acceptable for v1.`
**After:** `Stop mic capture immediately. Show "Reconnecting..." in status bar. Auto-reconnect with exponential backoff (1s, 2s, 4s, max 30s). **Do not buffer audio** during disconnect. Once reconnected, transition to paused and wait for user to resume (click Resume or press \`Ctrl+P\`). Some audio will be lost during the outage — this is acceptable for v1.`

### 9. Update spec: `spec/ui.md`

**Line 85:** Change `"Error", "Disconnected"` to `"Error", "Reconnecting..."` to match actual status text values.

### 10. Update spec: `spec/features/realtime-transcription.md`

**Line 36:** Rewrite to replace "Disconnected" with "Reconnecting..." to match actual behavior.

**Before:** `show "Disconnected" in status bar. Auto-reconnect with exponential backoff.`
**After:** `show "Reconnecting..." in status bar. Auto-reconnect with exponential backoff.`

### 11. Verify

Run TypeScript type-check and the session-reconnect tests to confirm no compile errors or test failures.

## Risks / Open Questions

- **Low risk:** The `disconnected` value is pure dead code — no runtime path produces it. Removing it cannot change behavior.
- **Spec wording in api.md (step 8):** The spec mentioned "Reconnected" as a third state shown after successful reconnect, but the code transitions to `paused`. The revised spec aligns with the code.
