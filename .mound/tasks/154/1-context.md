# Context — Task 154: Replay Ghost Regions

## Relevant Files

### Renderer — Editor plugins and nodes
- `src/renderer/overlay/editor/TokenCommitPlugin.tsx` — Commits final Soniox tokens to the editor as `TimestampedTextNode`s. Listens for `onTokensFinal` IPC. Uses `tag: 'historic'` to bypass undo history. Manages token merging via `pendingRef`. **Primary file to modify.**
- `src/renderer/overlay/editor/GhostTextPlugin.tsx` — Renders non-final Soniox tokens as ghost text via CSS `--ghost-text-content` property. Clears ghost text when final tokens arrive. Manages cursor tracking during ghost display.
- `src/renderer/overlay/editor/ghost-text-utils.ts` — `createGhostTextController` and `escapeForCSSContent` helper. Ghost text is rendered as a CSS `::after` pseudo-element, not as DOM nodes.
- `src/renderer/overlay/editor/TimestampedTextNode.ts` — Custom Lexical `TextNode` with `__startMs`, `__endMs`, `__originalText`. Clean if `text === originalText`, dirty otherwise.
- `src/renderer/overlay/editor/analyzeReplayEligibility.ts` — `$analyzeReplayEligibility()` function that inspects the live editor state and returns `ReplayAnalysisResult`. Already implemented and tested.
- `src/renderer/overlay/editor/tokenMerger.ts` — `mergeTokens()` and `flushPending()` for grouping sub-word Soniox tokens into word-level `MergedToken`s.
- `src/renderer/overlay/editor/editorBlockManager.ts` — Block-based document model (parallel to Lexical). `commitFinalText`, `applyEdit`, `getDocumentLength`. Used by TokenCommitPlugin.
- `src/renderer/overlay/editor/lexicalTextContract.ts` — `$getDocumentText()` and `LEXICAL_PARAGRAPH_SEPARATOR` constant.
- `src/renderer/overlay/editor/Editor.tsx` — Plugin composition. Plugin order determines `useEffect` registration order: TokenCommitPlugin before GhostTextPlugin.
- `src/renderer/overlay/editor/cursor-track-utils.ts` — `$isCursorAtDocumentEnd` and `$moveCursorToDocumentEnd`.

### Renderer — Context and lifecycle
- `src/renderer/overlay/OverlayContext.tsx` — React context with `editorRef`, `registerEditor`, `registerClearHook`. Handles IPC for session text, context text, audio capture. Task 152 plans to add a resume analysis handler here.

### Main process
- `src/main/soniox-lifecycle.ts` — Connection lifecycle: `connectSoniox`, `resumeCapture`, `resetLifecycle`, `applyTimestampOffset`. Module-level state: `soniox`, `connectionBaseMs`, `ringBuffer`, `awaitingFinalization`. Task 152 plans to add `reconnectWithContext()`. Task 153 plans to add `capturePendingStartMs()`/`getPendingStartMs()`.
- `src/main/session.ts` — Session state machine: `startSession`, `pauseSession`, `resumeSession`, `stopSession`. Task 152 plans to make `resumeSession` async with IPC round-trip for resume analysis.
- `src/main/audio-ring-buffer.ts` — `AudioRingBuffer` class with `push`, `sliceFrom(ms)`, `currentMs`. Already integrated (task 149).
- `src/main/renderer-send.ts` — `sendToRenderer(channel, data)` IPC helper.
- `src/main/session-ipc.ts` — IPC handler registration for session control.

### Shared
- `src/shared/ipc.ts` — IPC channel constants. Task 152 plans to add `SESSION_RESUME_ANALYSIS`.
- `src/shared/types.ts` — `SonioxToken`, `SessionState`, `EditorBlock`, `GhostText`, `ErrorInfo`. Task 152 plans to move `ReplayAnalysisResult` here and add `ResumeAnalysisResult`.
- `src/shared/preload.d.ts` — `ElectronAPI` type declarations. Task 152 plans to add `sendResumeAnalysis`/`onRequestResumeAnalysis`.
- `src/preload/index.ts` — Electron preload bridge implementation.

### Tests
- `src/renderer/overlay/editor/analyzeReplayEligibility.test.ts` — Test patterns for Lexical editor state: `createTestEditor()`, `clean()`/`dirty()` helpers, reading results via `editor.getEditorState().read()`.
- `src/main/soniox-lifecycle.test.ts` — Mock patterns: `MockSonioxClient` with shared `mockSonioxInstance`, `MockAudioRingBuffer`, mock audio/settings.

### Spec
- `spec/proposal-context-refresh.md` — Full design for context refresh, replay, ghost conversion, dirty-leaf model, prefix/suffix matching.

## Architecture

### Subsystem: Token commit and ghost text pipeline

Audio from the microphone flows through `AudioRingBuffer` → `SonioxClient` WebSocket. Soniox returns tokens in two streams:

1. **Non-final tokens** → `TOKENS_NONFINAL` IPC → `GhostTextPlugin` sets CSS `--ghost-text-content` on the editor root element. Ghost text appears as a `::after` pseudo-element. Visually indicates "Soniox is still processing."

2. **Final tokens** → `TOKENS_FINAL` IPC → `TokenCommitPlugin.commitWords()` creates `TimestampedTextNode` per word (via `tokenMerger`), appends to last paragraph with `tag: 'historic'` (bypasses undo). `GhostTextPlugin` simultaneously clears the CSS property.

Token timestamps arrive already offset by `connectionBaseMs` (applied in `soniox-lifecycle.ts` via `applyTimestampOffset`).

### Replay flow (to be implemented)

When the user pauses, edits text, and resumes:
1. Renderer computes replay eligibility (`$analyzeReplayEligibility`)
2. Main receives the analysis, decides to reconnect with fresh context
3. Main opens connection B, sets `connectionBaseMs = replayStartMs`
4. **Before sending replay audio**: renderer converts eligible clean tail to ghost text (removes committed nodes, sets CSS ghost text)
5. Main sends buffered replay audio from ring buffer to connection B
6. Connection B's non-final tokens flow through normal `GhostTextPlugin` (overwriting the initial ghost text with live preview)
7. Connection B's final tokens flow through normal `TokenCommitPlugin` (re-committing with fresh timestamps)
8. After all replay audio is finalized, ghost text clears naturally
9. Post-resume live audio (buffered locally during replay) is flushed to B

### Key constraints
- Ghost text is a single CSS property — only one source at a time (live or replay). During replay, no live tokens flow (live audio buffered locally).
- `tag: 'historic'` is required for all transcription mutations — `InlineEditPlugin`, `UserTypingPlugin`, `UndoRedoBlockSyncPlugin` all skip `historic`-tagged updates.
- `editorBlockManager` must be kept in sync with editor state. `InlineEditPlugin` ignores `historic` updates, so manual sync is needed when removing nodes in a `historic` update.
- Plugin order in `Editor.tsx` matters: `TokenCommitPlugin`'s `onTokensFinal` handler fires before `GhostTextPlugin`'s, ensuring text is committed before ghost is cleared.
