# Context — Task 152: Connection Handoff on Resume

## Relevant Files

- **`src/main/session.ts`** — Session manager. Orchestrates start/pause/resume/stop. `resumeSession()` is the primary function to modify — it currently just resumes mic capture, but needs to detect edits and trigger reconnection.
- **`src/main/session.test.ts`** — Session manager tests. Mock-heavy (electron ipcMain, SonioxClient, audio, window). Tests pause/resume/stop flows.
- **`src/main/soniox-lifecycle.ts`** — Lifecycle manager for Soniox connections. Module-level state. Manages connect, reconnect, audio routing through ring buffer. Needs a new `reconnectWithContext()` function.
- **`src/main/soniox-lifecycle.test.ts`** — Lifecycle unit tests. Mocks SonioxClient, audio, ring buffer.
- **`src/main/audio-ring-buffer.ts`** — Circular buffer storing timestamped PCM audio chunks. Exposes `currentMs` (total session audio time captured). Used to derive `sessionAudioEndMsAtResume`.
- **`src/main/soniox.ts`** — `SonioxClient` WebSocket wrapper. `connect(settings, contextText?)` accepts context text. Unchanged by this task.
- **`src/main/renderer-send.ts`** — Helper for sending IPC messages to the renderer.
- **`src/main/session-ipc.ts`** — Registers IPC handlers for pause/resume/dismiss from renderer. `SessionIpcActions` interface defines the callbacks.
- **`src/shared/ipc.ts`** — IPC channel constants. Needs new channel for resume analysis.
- **`src/shared/types.ts`** — Shared type definitions (SonioxToken, SessionState, ErrorInfo, etc.). Needs `ReplayAnalysisResult` added.
- **`src/shared/preload.d.ts`** — TypeScript declarations for the preload API exposed to the renderer. Needs new methods for resume analysis IPC.
- **`src/preload/index.ts`** — Preload script implementing the `ElectronAPI` interface. Needs to wire new IPC channels.
- **`src/renderer/overlay/OverlayContext.tsx`** — React context providing session state and editor reference to the overlay UI. Handles IPC request/response for context text. Needs a similar handler for resume analysis.
- **`src/renderer/overlay/editor/analyzeReplayEligibility.ts`** — Pure analysis function `$analyzeReplayEligibility()` that inspects the Lexical editor state and returns `ReplayAnalysisResult`. Already implemented (task 151). Called inside `editorState.read()`.
- **`src/renderer/overlay/editor/lexicalTextContract.ts`** — `$getDocumentText()` reads the full editor text from Lexical state.
- **`spec/proposal-context-refresh.md`** — Spec defining the full context-refresh design including connection handoff, `connectionBaseMs`, and replay flow.

## Architecture

### Session management (main process)

`session.ts` is the central coordinator. It manages the session lifecycle through status transitions (`idle → connecting → recording → paused → recording → finalizing → idle`). It delegates to `soniox-lifecycle.ts` for WebSocket connection management and to renderer IPC for editor interaction.

The pause flow: `pauseSession()` stops capture, sends finalize to Soniox, awaits finalization, then signals renderer via `SESSION_PAUSED`.

The resume flow (current): `resumeSession()` calls `resumeCapture()` which restarts mic → ring buffer → WebSocket audio routing, then signals renderer via `SESSION_RESUMED`.

### Soniox lifecycle (main process)

`soniox-lifecycle.ts` uses module-level `let` variables for state (not a class). Key state: `soniox` (current SonioxClient), `ringBuffer` (AudioRingBuffer), `storedContextText`, `activeCallbacks`, `connectionBaseMs` (from task 150).

`connectSoniox()` creates a fresh connection for session start. `attemptReconnect()` handles network error recovery. This task adds `reconnectWithContext()` for deliberate context-refresh reconnection.

The ring buffer persists across pause/resume and even network reconnects. It's only reset on `resetLifecycle()` (session end). `ringBuffer.currentMs` represents total session audio time — this is `sessionAudioEndMsAtResume`.

### IPC request/response pattern

Main-to-renderer requests follow a fire-and-forget pattern with a matching response listener:
1. Main registers a one-time listener for the response channel
2. Main sends request to renderer
3. Renderer processes and sends response on the same channel
4. Main's listener resolves a Promise

See `getEditorContextText()` in `session.ts` for the canonical example (uses `SESSION_CONTEXT` channel).

### Renderer editor access

`OverlayContext.tsx` stores a `LexicalEditor` reference via `registerEditor()`. IPC request handlers access the editor through this ref, then call `editorState.read()` to safely read Lexical state. This pattern is used for both session text and context text requests and will be reused for resume analysis.

### Task 150 dependency

Task 150 (currently implementing) adds:
- `let connectionBaseMs = 0;` module-level variable
- `applyTimestampOffset(tokens, offsetMs)` function (offsets token timestamps)
- `getConnectionBaseMs()` getter
- Offset applied to all token callbacks in `connectSoniox()` and `attemptReconnect()`
- Reset in `resetLifecycle()`
- Does NOT export a setter — this task introduces the mechanism for setting `connectionBaseMs`
