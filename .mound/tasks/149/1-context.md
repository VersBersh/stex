# Context

## Relevant Files

- **`src/main/soniox-lifecycle.ts`** — The lifecycle module that manages the Soniox WebSocket connection, audio capture start/stop, reconnection, and finalization. This is the primary file to modify.
- **`src/main/soniox-lifecycle.test.ts`** — Existing test suite for soniox-lifecycle. Tests use vi.mock for audio, soniox, settings, etc. New tests for ring buffer integration go here.
- **`src/main/audio.ts`** — Audio capture module (startCapture/stopCapture). Pipes chunks via callback to soniox-lifecycle's `onAudioData`. Not modified by this task.
- **`src/main/soniox.ts`** — SonioxClient WebSocket wrapper. `sendAudio(chunk)` sends PCM to Soniox. Not modified by this task.
- **`src/main/session.ts`** — Session manager that orchestrates start/pause/resume/stop by calling soniox-lifecycle functions. Calls `connectSoniox`, `resetLifecycle`, `resumeCapture`, etc. Not modified by this task but is a consumer of the lifecycle API.
- **`src/main/audio-level-monitor.ts`** — Audio level monitor and sound event detector. Pattern reference: shows how per-chunk processing modules are instantiated in lifecycle and nulled on reset.
- **`src/shared/types.ts`** — Shared type definitions (SonioxToken, SessionState, AppSettings, etc.).
- **`spec/proposal-context-refresh.md`** — Spec for the context-refresh feature. "Audio ring buffer" section defines the buffer's format, capacity, API, and lifecycle.
- **`.mound/tasks/148/description.md`** — Task 148 defines the AudioRingBuffer module itself (class with `push`, `sliceFrom`, `clear`). This is an unresolved dependency — the module is being implemented in parallel.

## Architecture

The audio pipeline flows: **Renderer AudioWorklet** → IPC (`AUDIO_CHUNK`) → **`audio.ts`** `startCapture` callback → **`soniox-lifecycle.ts`** `onAudioData` → **`soniox.ts`** `sendAudio` → Soniox WebSocket.

`soniox-lifecycle.ts` is a module-scoped singleton managing:
- A `SonioxClient` instance (`soniox`)
- Audio level monitoring (`levelMonitor`, `soundEventDetector`)
- Reconnection state (`reconnectTimer`, `reconnectAttempt`)
- Finalization state (`awaitingFinalization`)
- Context text (`storedContextText`)

Key lifecycle points:
- **Session start** (`connectSoniox`): creates SonioxClient, audio monitors; on WebSocket connect, starts audio capture with `onAudioData` callback.
- **Session end** (`resetLifecycle`): disconnects client, nulls all state, flushes sound events.
- **Audio flow** (`onAudioData`): sends chunk to Soniox, computes dB, feeds level monitor and sound event detector.
- **Reconnect** (`attemptReconnect`): creates new SonioxClient but does NOT restart audio capture (reconnects to paused state).

Pattern for per-chunk processors: declared as module-level nullable variables, created in `connectSoniox`, nulled in `resetLifecycle`, fed in `onAudioData`.
