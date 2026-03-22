# UI: Drive pause/resume state from main-process IPC events

## Summary
The overlay renderer currently uses an optimistic local `pauseRequested` state toggle for pause/resume. When the session manager (T11) is integrated, the renderer should instead derive its pause/resume state from main-process `session:paused` / `session:resumed` IPC events rather than maintaining local optimistic state.

This decouples the UI from session management semantics and ensures the displayed state always reflects the true session state.

Discovered during T7 (Overlay UI Shell) code review — flagged as semantic coupling between UI state and session lifecycle.

## Acceptance criteria
- The renderer listens for `session:paused` and `session:resumed` IPC events from the main process
- The pause/resume button in the overlay reflects the actual session state received via IPC
- The local `pauseRequested` optimistic state is removed or replaced
- The pause button sends a request to the main process (e.g., `session:toggle-pause`) rather than toggling local state directly
- Unit tests verify the renderer reacts correctly to IPC state changes

## References
- T11 (Session Manager — orchestrate start/stop/pause/resume lifecycle) — this task depends on T11 being implemented
- T30 (Wire session lifecycle to overlay show/hide) — related session-lifecycle wiring
- Current overlay renderer pause state implementation from T7
