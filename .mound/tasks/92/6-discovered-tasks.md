# Discovered Tasks

1. **MAIN: Add renderer-process logging or IPC log forwarding**
   - The new logger only covers the main process. Renderer-side errors (editor, UI) are not captured.
   - Discovered when reviewing the codebase and noticing no logging in renderer modules.

2. **MAIN: Expose log file path in settings UI**
   - Users may need to find logs for bug reports. Currently the log path is buried in the userData directory.
   - Discovered when implementing the logger and noting there's no way for users to locate logs.
