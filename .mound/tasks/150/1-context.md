# Context — Task 150: Track connectionBaseMs and offset Soniox token timestamps

## Relevant Files

- **`src/main/soniox-lifecycle.ts`** — Lifecycle manager for Soniox connections. Manages connect, reconnect, pause/finalize, audio routing, and exposes narrow API (`connectSoniox`, `sendAudio`, `finalizeSoniox`, etc.). Module-level state (no class). This is the primary file to modify: `connectionBaseMs` belongs here.
- **`src/main/soniox-lifecycle.test.ts`** — Unit tests for lifecycle module; mocks SonioxClient, audio, settings. Tests must be extended for `connectionBaseMs`.
- **`src/main/soniox.ts`** — Low-level WebSocket client (`SonioxClient`). Emits `onFinalTokens`/`onNonFinalTokens` with raw `SonioxToken` arrays whose `start_ms`/`end_ms` are connection-relative (always start at 0). Not changed by this task.
- **`src/main/session.ts`** — Session orchestrator. Calls `connectSoniox()`, creates lifecycle callbacks that forward tokens to the renderer via IPC. The `createLifecycleCallbacks()` function is the interception point where offsetting should happen (or alternatively in the lifecycle module before callbacks are invoked).
- **`src/shared/types.ts`** — Shared types including `SonioxToken { text, start_ms, end_ms, confidence, is_final }`.
- **`src/preload/index.ts`** — IPC bridge; forwards `TOKENS_FINAL` / `TOKENS_NONFINAL` arrays to renderer. No changes needed.
- **`src/renderer/overlay/editor/TokenCommitPlugin.tsx`** — Renderer plugin that receives final tokens and creates `TimestampedTextNode`s using `token.start_ms` / `token.end_ms`. If offsetting is done in main, this file needs no changes.
- **`src/renderer/overlay/editor/TimestampedTextNode.ts`** — Lexical node storing `startMs`, `endMs`, `originalText`. Consumes already-offset timestamps.
- **`src/renderer/overlay/editor/GhostTextPlugin.tsx`** — Renders non-final tokens as CSS ghost text. Uses token text only, not timestamps, so unaffected.
- **`src/renderer/overlay/editor/ghost-text-utils.ts`** — Ghost text controller; uses token text only.
- **`src/main/audio-ring-buffer.ts`** — Ring buffer tracking session audio time via monotonic sample counter (`currentMs`). Its `currentMs` provides the `sessionAudioEndMsAtResume` value needed for future tasks.
- **`spec/proposal-context-refresh.md`** — Spec describing the full context-refresh design including `connectionBaseMs` concept, timestamp mapping formula, and replay flow.

## Architecture

### Token flow (current)

```
SonioxClient (soniox.ts)
  → emits onFinalTokens/onNonFinalTokens with raw SonioxToken[]
  → soniox-lifecycle.ts callbacks forward to session callbacks
  → session.ts createLifecycleCallbacks() sends tokens via IPC to renderer
  → preload/index.ts bridges IPC to window.api
  → TokenCommitPlugin.tsx creates TimestampedTextNode(text, start_ms, end_ms)
  → GhostTextPlugin.tsx renders non-final token text as ghost text
```

### Key constraint

Soniox token `start_ms`/`end_ms` are **per-connection relative** — they always start at 0 for a newly opened WebSocket. For the initial connection this doesn't matter, but any reconnect (network, or pause-edit-resume) means token timestamps from the new connection would collide with/overlap timestamps from the previous connection.

### What this task introduces

A single `connectionBaseMs` variable in `soniox-lifecycle.ts` that:
1. Is set to `0` for the initial connection (no behavioral change)
2. Will be set to `replayStartMs` or `sessionAudioEndMsAtResume` by future tasks (152, 153)
3. Is applied to all outgoing tokens: `token.start_ms += connectionBaseMs`, `token.end_ms += connectionBaseMs`

The offset must be applied **once**, in a **single place**, before tokens reach any consumer (session callbacks, IPC, renderer). The natural place is in `soniox-lifecycle.ts` where the lifecycle wraps `SonioxClient` callbacks.

### Module state pattern

`soniox-lifecycle.ts` uses module-level `let` variables for state (not a class). New state follows the same pattern: `let connectionBaseMs = 0;`.
