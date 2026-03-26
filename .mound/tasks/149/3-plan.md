# Plan

## Goal

Wire `AudioRingBuffer` into `soniox-lifecycle.ts` so every captured audio chunk passes through the ring buffer before being sent to Soniox, without changing observable behavior.

## Steps

### Step 1: Add ring buffer state to `soniox-lifecycle.ts`

**File:** `src/main/soniox-lifecycle.ts`

Add an import for `AudioRingBuffer` from the module created by task 148 (expected path: `./audio-ring-buffer`). Add a module-level variable following the existing pattern for `levelMonitor` and `soundEventDetector`:

```ts
import { AudioRingBuffer } from './audio-ring-buffer';

let ringBuffer: AudioRingBuffer | null = null;
```

Place the import after the existing imports (line 1-8 area). Place the variable declaration after the existing module-level variables (around line 27, after `awaitingFinalization`).

### Step 2: Create ring buffer in `connectSoniox`

**File:** `src/main/soniox-lifecycle.ts`

In `connectSoniox()` (line 171), create a new `AudioRingBuffer` instance at the start of the function, alongside the existing `audioChunkCount = 0` and `levelMonitor = createAudioLevelMonitor()` setup:

```ts
ringBuffer = new AudioRingBuffer();
```

Place it after `audioChunkCount = 0` (line 172) and before or alongside `levelMonitor = createAudioLevelMonitor()` (line 175). The exact position within the setup block doesn't matter — follow the existing ordering style.

**No parameters needed**: The `AudioRingBuffer` constructor will use default capacity (5 minutes) as defined by task 148.

### Step 3: Push audio chunks into ring buffer in `onAudioData`

**File:** `src/main/soniox-lifecycle.ts`

In the `onAudioData` function (line 121), add `ringBuffer?.push(chunk)` **before** the existing `soniox?.sendAudio(chunk)` call. This ensures the buffer accumulates audio regardless of WebSocket state:

```ts
function onAudioData(chunk: Buffer): void {
  ringBuffer?.push(chunk);       // <-- new line
  soniox?.sendAudio(chunk);      // existing
  // ... rest of function unchanged
}
```

Using `?.` (optional chaining) matches the existing pattern used for `soniox?.sendAudio` and handles the case where ringBuffer is null gracefully.

### Step 4: Clear ring buffer in `resetLifecycle`

**File:** `src/main/soniox-lifecycle.ts`

In `resetLifecycle()` (line 64), clear and null out the ring buffer alongside the other state cleanup:

```ts
ringBuffer?.clear();
ringBuffer = null;
```

Place this after `storedContextText = null` (line 70) and before/alongside the existing `levelMonitor = null` (line 71). This follows the existing pattern of nulling state in `resetLifecycle`.

### Step 5: Add tests for ring buffer integration

**File:** `src/main/soniox-lifecycle.test.ts`

Add a mock for the `AudioRingBuffer` module in the hoisted mocks section, and add a new `describe('audio ring buffer')` test block covering:

1. **Ring buffer created on connect**: After `connectSoniox()`, verify the `AudioRingBuffer` constructor was called.
2. **Audio chunks pushed to ring buffer**: After triggering `onConnected` and simulating audio chunks via the `startCapture` data callback, verify `push` was called with each chunk.
3. **Push called before sendAudio**: Verify `push` is called before `sendAudio` by checking mock call ordering.
4. **Ring buffer cleared on reset**: After `resetLifecycle()`, verify `clear()` was called.
5. **Ring buffer persists across disconnect/reconnect**: The ring buffer is NOT cleared in `handleDisconnect` or reconnect — only in `resetLifecycle`. Verify that after a reconnectable disconnect and timer-driven reconnect, `clear` was not called and the ring buffer instance remains the same.

Mock structure (in the hoisted block):

```ts
const mockRingBufferInstance = {
  push: vi.fn(),
  sliceFrom: vi.fn(),
  clear: vi.fn(),
};

vi.mock('./audio-ring-buffer', () => ({
  AudioRingBuffer: vi.fn(() => mockRingBufferInstance),
}));
```

**Note on integration testing**: These unit tests verify the wiring (constructor, push, clear calls) using a mocked AudioRingBuffer. Integration testing with a real AudioRingBuffer instance — verifying that audio captured before a pause is actually retrievable via `sliceFrom` — should be added once task 148 is merged and the real class is available.

## Risks / Open Questions

1. **Dependency on task 148**: The `AudioRingBuffer` module does not yet exist on main (task 148 is in `implementing` status). The import path (`./audio-ring-buffer`) and constructor signature (`new AudioRingBuffer()`) are assumed from task 148's description and the spec. If task 148 uses a different module path or requires constructor arguments (e.g., capacity), the import and instantiation will need adjustment. This is low risk since the API is well-specified.

2. **No public accessor for the ring buffer in this task**: The acceptance criteria mentions "audio that can be retrieved via `sliceFrom` during a pause." This task ensures the buffer accumulates data correctly. The accessor to expose `sliceFrom` to `session.ts` (or a narrower `sliceBufferedAudioFrom(ms)` wrapper) will be added in the future task that implements the replay/context-refresh flow. Exposing the mutable buffer singleton now would leak internal state beyond the routing-only scope.

3. **Memory**: The ring buffer holds ~9.6MB. Created per session, destroyed on reset. No concern for typical usage.

4. **No reconnect-time buffer re-creation**: When `attemptReconnect` creates a new SonioxClient, it does NOT re-create the ring buffer. This is correct — the ring buffer persists across the session and accumulates audio continuously. Audio capture is stopped during reconnection, so no chunks arrive to the buffer during that window.
