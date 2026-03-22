# Discovered Tasks

1. **PRELOAD: Add preload script for settings window**
   - The settings window has `contextIsolation: true` but no preload script. When the settings UI needs to read/write settings via IPC, it will need its own preload bridge.
   - Discovered when implementing the overlay preload: the same pattern needs to be applied to settings.

2. **UI: Add dark theme CSS support**
   - The overlay CSS is light-theme only (hardcoded `#fff` background, `#1a1a1a` text). The spec requires dark mode support following system theme.
   - Discovered when writing overlay.css — deferred as outside scope of this shell task.

3. **TEST: Split window.test.ts by responsibility**
   - The window test file is now 361 lines covering construction, positioning, opacity, close interception, settings window, and IPC mocking. Should be split into focused test files.
   - Discovered during code review (design review flagged it as a code smell).

4. **UI: Pause state should be driven by main process**
   - The current `pauseRequested` state is an optimistic UI toggle. When session management is integrated, the renderer should derive pause/resume state from main-process `session:paused` / `session:resumed` IPC events rather than local state.
   - Discovered during code review (design review flagged the optimistic state as semantic coupling).
