# Plan — Task 88

## Goal

Extract `sendToRenderer`, `sendStatus`, `sendError`, and `clearError` from `session.ts` into a dedicated `renderer-send.ts` module to make the main→renderer communication boundary explicit.

## Steps

### Step 1: Create `src/main/renderer-send.ts`

Create a new module with the following exports:

```ts
import { getOverlayWindow } from './window';
import { IpcChannels } from '../shared/ipc';
import type { SessionState, ErrorInfo } from '../shared/types';

export function sendToRenderer(channel: string, ...args: unknown[]): void {
  const win = getOverlayWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}

export function sendStatus(status: SessionState['status']): void {
  sendToRenderer(IpcChannels.SESSION_STATUS, status);
}

export function sendError(error: ErrorInfo | null): void {
  sendToRenderer(IpcChannels.SESSION_ERROR, error);
}

export function clearError(): void {
  sendError(null);
}
```

Key change: `sendStatus` now takes `status` as a parameter instead of reading from module-level state. This is necessary because `status` is local state in session.ts and should not be shared. All call sites in session.ts already have `status` in scope.

### Step 2: Update `src/main/session.ts`

1. Add import: `import { sendToRenderer, sendStatus, sendError, clearError } from './renderer-send';`
2. Remove the four function definitions (`sendToRenderer`, `sendStatus`, `sendError`, `clearError`) from session.ts (lines 18-35).
3. Remove the now-unused `IpcChannels` import **only if** no other references remain. Check: `IpcChannels` is still used directly in session.ts for `SESSION_START`, `TOKENS_FINAL`, `TOKENS_NONFINAL`, `SESSION_PAUSED`, `SESSION_RESUMED`, `SESSION_STOP`, `SESSION_TEXT` — so the import stays.
4. Update all `sendStatus()` calls (no args) to `sendStatus(status)` — passing the local `status` variable explicitly. Call sites:
   - `startSession()` line 108: `sendStatus(status)` (status is 'connecting')
   - `pauseSession()` line 127: `sendStatus(status)` (status is 'paused' — but it's set earlier, just pass `status`)
   - `resumeSession()` line 142: `sendStatus(status)` (status is 'recording')
   - `stopSession()` line 151: `sendStatus(status)` (status is 'finalizing')
   - `stopSession()` line 176: `sendStatus(status)` (status is 'idle')
   - `requestQuickDismiss()` line 222: `sendStatus(status)` (status is 'idle')
   - `initSessionManager` → `onDismissError` line 241: `sendStatus(status)` (status is 'idle')
5. The `createLifecycleCallbacks().onStatusChange` callback (line 91-94) sets `status = newStatus` then calls `sendStatus()`. Update to `sendStatus(newStatus)` (or `sendStatus(status)` since status was just set — use `status` for consistency).
6. Remove `SessionState` from the types import **only if** no other references remain. Check: `SessionState` is used in `createLifecycleCallbacks` for the `onStatusChange` parameter type, so the import stays.

### Step 3: Verify no other consumers

Grep for any other files importing/using these functions. Based on exploration:
- `soniox-lifecycle.ts` does NOT use these functions directly — it uses the callback interface. No changes needed.
- `session.test.ts` mocks `getOverlayWindow` and asserts `webContents.send` — tests don't import the send functions directly. No test changes needed.
- `soniox-lifecycle.test.ts` — no changes needed.

## Risks / Open Questions

1. **`sendStatus` signature change**: The original `sendStatus()` reads module-level `status`. The extracted version takes it as a parameter. All call sites have `status` in local scope so this is safe, but each call site must be updated.
2. **soniox-lifecycle does NOT need to import from the new module** — contrary to the task description. The callback pattern already decouples it. This is correct behavior; the task description's acceptance criterion about soniox-lifecycle importing is inaccurate.
3. **Test mocking**: Since `session.test.ts` mocks `./window` (providing `getOverlayWindow`), the extracted module will use the same mock transparently — Vitest's module mocking works at the module level, so `renderer-send.ts` calling `getOverlayWindow` will get the mock. No test changes needed.
