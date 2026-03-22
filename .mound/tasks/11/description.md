# T11: Session Manager

## Summary

Implement the Session Manager that orchestrates the full transcription session lifecycle, wiring together audio capture, the Soniox client, the hotkey/window system, and IPC to the renderer.

## Scope

- Create `src/main/session.ts`
- **State machine** with states: `idle`, `connecting`, `recording`, `paused`, `finalizing`, `error`
- **Start** (triggered by window show):
  1. Transition to `connecting`
  2. Connect Soniox WebSocket
  3. Start audio capture
  4. Pipe audio chunks to Soniox client
  5. Transition to `recording`
  6. Forward final tokens to renderer via IPC (`tokens:final`)
  7. Forward non-final tokens to renderer via IPC (`tokens:nonfinal`)
  8. Send status changes via IPC (`session:status`)
- **Pause** (triggered by `session:request-pause` IPC or Ctrl+P):
  1. Stop mic capture
  2. Send empty frame to Soniox for finalization
  3. Wait for `finished: true`
  4. Commit final tokens, clear ghost text
  5. Transition to `paused` (WebSocket stays open)
- **Resume** (triggered by `session:request-resume` IPC or Ctrl+P):
  1. Restart mic capture
  2. Resume audio streaming on existing WebSocket
  3. Transition to `recording`
- **Stop/Hide** (triggered by window hide):
  1. Transition to `finalizing`
  2. Stop mic capture
  3. Send empty frame for finalization
  4. Wait for `finished: true`
  5. Commit final tokens
  6. Signal renderer to provide final text (`session:text`)
  7. Close WebSocket
  8. Transition to `idle`
- Wire to main process entry point (`src/main/index.ts`)

## Acceptance Criteria

- Full lifecycle works: start → record → pause → resume → stop
- State transitions are correct and observable via IPC
- Tokens flow from Soniox through IPC to renderer
- Pause finalizes pending tokens before entering paused state
- Stop finalizes and waits before closing
- No resource leaks (WebSocket and audio streams are cleaned up)

## References

- `spec/architecture.md` — Session Manager responsibilities, data flow, IPC messages
- `spec/features/realtime-transcription.md` — starting/ending sessions
- `spec/features/inline-editing.md` — pause semantics
- `spec/api.md` — manual finalization, connection lifecycle
