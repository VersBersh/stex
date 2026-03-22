# T17: Error Handling & Reconnection

## Summary

Implement error handling UI and WebSocket auto-reconnection with exponential backoff, covering API key errors, network failures, and microphone permission issues.

## Scope

- **Error banner UI** (overlay renderer):
  - Compact banner between editor and status bar
  - Shows error message + optional action button (e.g., "Open Settings" for API key issues)
  - Dismiss button (X) to clear
  - Not auto-dismissed — user must dismiss or resolve the error
- **WebSocket auto-reconnect**:
  - On disconnect: stop mic capture, show "Disconnected" in status bar
  - Auto-reconnect with exponential backoff: 1s, 2s, 4s, max 30s
  - Show "Reconnecting..." during attempts
  - On reconnect: show "Reconnected", wait for user to resume (click Resume or Ctrl+P)
  - Do NOT buffer audio during disconnect — some speech loss is acceptable for v1
- **Specific error handling**:
  - Invalid API key → error banner + "Open Settings" action + stop recording
  - Rate limit / quota exceeded → error banner + stop recording
  - Microphone access denied → "Microphone access denied" in status bar + banner with "Grant access in Windows Settings" link
  - Audio device unavailable → error banner + stop recording

## Acceptance Criteria

- Error banner displays for all error conditions with appropriate messages
- Error banner has dismiss button and optional action button
- WebSocket reconnects automatically with exponential backoff
- Status bar reflects error/disconnected/reconnecting states
- Invalid API key directs user to settings
- Mic permission denial shows actionable error

## References

- `spec/ui.md` — error states, error banner design
- `spec/api.md` — error handling table, reconnection behavior
- `spec/features/system-tray.md` — microphone permission flow
