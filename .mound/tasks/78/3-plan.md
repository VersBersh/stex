# Plan — Task 78

## Goal

Extract IPC handler registration and Soniox lifecycle management from `session.ts` into dedicated modules, reducing it to a thin orchestration layer.

## Steps

### 1. Create `src/main/session-ipc.ts` — IPC handler registration

Extract the IPC wiring concern from `initSessionManager()` into a dedicated module.

**New file: `src/main/session-ipc.ts`**

Exports:
- `SessionIpcActions` interface — `{ onPause, onResume, onDismissError, onEscapeHide }` callbacks
- `registerSessionIpc(actions: SessionIpcActions): void` — removes old listeners, creates new handler wrappers that delegate to action callbacks, registers them on `ipcMain`. Also wires `showSettings` and `shell.openExternal('ms-settings:privacy-microphone')` for the settings/mic-settings channels.

Module-level state: 6 handler reference variables for cleanup (same pattern as existing code).

The `removeHandler` helper moves here from `session.ts`.

### 2. Create `src/main/soniox-lifecycle.ts` — Soniox client lifecycle

Extract Soniox client creation, event wiring, reconnection, and teardown.

**New file: `src/main/soniox-lifecycle.ts`**

Exports:
- `SonioxLifecycleCallbacks` interface:
  - `onFinalTokens(tokens: SonioxToken[]): void`
  - `onNonFinalTokens(tokens: SonioxToken[]): void`
  - `onStatusChange(status: SessionState['status']): void` (typed, not `string`)
  - `onError(error: ErrorInfo | null): void`
  - `onFinalizationComplete(): void`
- `getSonioxClient(): SonioxClient | null`
- `cancelReconnect(): void` — clears timer + resets attempt counter
- `resetLifecycle(): void` — calls `cancelReconnect()` + disconnects + nulls client. Single cleanup path for all callers (init, stop, quick dismiss).
- `connectSoniox(callbacks: SonioxLifecycleCallbacks): void` — creates `SonioxClient` with event wiring, starts connection. On connect: starts audio capture. On disconnect: classifies and either schedules reconnect or sets error.
- `attemptReconnect(callbacks: SonioxLifecycleCallbacks): void` — internal, used by `scheduleReconnect`

Key design decisions:
- `callbacks` are stored at module level on `connectSoniox()` to avoid duplicating `scheduleReconnect` in both `connectSoniox` and `attemptReconnect`. This is safe because only one Soniox lifecycle is active at a time (singleton pattern).
- `resetLifecycle()` is the single cleanup API that `session.ts` calls from `initSessionManager`, `stopSession`, and `requestQuickDismiss`.
- Token forwarding uses typed callbacks (`onFinalTokens`, `onNonFinalTokens`) instead of generic `sendToRenderer(channel, ...args)`.

### 3. Update `src/main/session.ts` — thin orchestration layer

Remove extracted concerns and delegate to the new modules. The file retains:
- Module-level state: `status`, `activeTransition`, `currentFinalizationResolver`, `initialized`
- `sendToRenderer`, `sendStatus`, `sendError` helpers
- `waitForFinalization`, `waitForClipboardText` (clipboard concern)
- Session state transitions: `startSession`, `pauseSession`, `resumeSession`, `stopSession`
- Public API: `requestToggle`, `requestQuickDismiss`, `initSessionManager`

Changes:
- Remove: all IPC handler variables, `removeHandler`, `soniox`, `reconnectTimer`, `reconnectAttempt`, `onAudioData`, `onAudioError`, `cancelReconnect`, `scheduleReconnect`, `attemptReconnect`, `handleDisconnect`, `createSonioxEvents`
- Import `registerSessionIpc` from `./session-ipc`
- Import `connectSoniox`, `getSonioxClient`, `cancelReconnect`, `resetLifecycle` from `./soniox-lifecycle`
- `initSessionManager`: call `resetLifecycle()` then `registerSessionIpc({ onPause, onResume, onDismissError, onEscapeHide })`
- `startSession`: call `connectSoniox(callbacks)` where callbacks wire `sendToRenderer`, `sendStatus`, `sendError`, `currentFinalizationResolver`
- Replace `soniox?.xxx()` with `getSonioxClient()?.xxx()` in `pauseSession`, `stopSession`, `requestQuickDismiss`
- `stopSession`: call `cancelReconnect()` then `resetLifecycle()` at end
- `requestQuickDismiss`: call `cancelReconnect()` then `resetLifecycle()`

Expected result: ~150-170 lines of pure orchestration.

### 4. Verify tests pass

Run `npx vitest run src/main/session.test.ts src/main/session-reconnect.test.ts`. Tests mock `./soniox`, `./audio`, `./window`, `./settings`, and `electron` at module level. Since the new modules import from these same paths, vitest's module-level mocks apply transitively. No test changes expected.

## Risks / Open Questions

1. **`scheduleReconnect` duplication eliminated**: By storing callbacks at module level in `soniox-lifecycle.ts`, `scheduleReconnect` is defined once and shared between initial-connection and reconnect-attempt paths. This introduces a mild temporal coupling (must call `connectSoniox` before `scheduleReconnect` works), but `resetLifecycle` resets this cleanly.

2. **Test mock boundaries**: Tests mock `./soniox` at module level. Since `soniox-lifecycle.ts` also imports from `./soniox`, vitest's mock applies to it too. This is the standard vitest behavior and should work without test changes. If it doesn't (e.g. the mock doesn't reach the new module), the test files will need `vi.mock('./soniox-lifecycle')` — but this is unlikely.

3. **Module-level state**: Both extracted modules use module-level singleton state. This is consistent with the existing Electron main-process patterns throughout the codebase (window.ts, settings.ts, etc.).
