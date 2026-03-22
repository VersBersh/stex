# Wire session lifecycle to overlay show/hide

## Summary
`showOverlay()` and `hideOverlay()` in the Window Manager currently only manage window visibility. The spec requires that showing the overlay triggers session start (audio capture, WebSocket connection) and hiding it triggers finalization and clipboard copy. The Session Manager must wrap these calls with the appropriate lifecycle behavior.

This is an integration task connecting the Window Manager's show/hide events to the Session Manager's start/stop lifecycle.

## Acceptance criteria
- Showing the overlay window triggers a session start via the Session Manager (audio capture begins, WebSocket connection opens).
- Hiding the overlay window triggers session finalization (audio stops, final tokens received) and clipboard copy of the transcribed text.
- The Window Manager itself does not contain session logic — all orchestration goes through the Session Manager.

## References
- Discovered in T4 (Window Manager implementation): `.mound/tasks/4/6-discovered-tasks.md` item #2
- Related: T11 (Session Manager), T16 (Text Output / finalization flow)
- `spec/features/system-tray.md` (show/hide triggers)
