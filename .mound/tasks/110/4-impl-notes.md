# Implementation Notes

## Files modified

- `src/shared/types.ts` — Removed `"disconnected"` from `SessionState.status` union type
- `src/renderer/overlay/components/StatusBar.tsx` — Removed `disconnected: 'Disconnected'` from `STATUS_TEXT` map
- `src/main/session.ts` — Removed `|| status === 'disconnected'` from `onDismissError` handler
- `src/renderer/overlay/OverlayContext.tsx` — Removed `disconnected` from comment listing no-op states
- `src/main/session-reconnect.test.ts` — Renamed test from "disconnected state" to "reconnecting state"; fixed misleading comment
- `spec/models.md` — Removed `"disconnected"` from `SessionState.status` union
- `spec/architecture.md` — Removed `disconnected` from `session:status` IPC values list
- `spec/api.md` — Rewrote WebSocket disconnect row to match actual behavior (no "Disconnected"/"Reconnected" states)
- `spec/ui.md` — Changed example status text from "Disconnected" to "Reconnecting..."
- `spec/features/realtime-transcription.md` — Changed "Disconnected" to "Reconnecting..." in network interruption edge case

## Deviations from plan

None.

## New tasks or follow-up work

None discovered.
