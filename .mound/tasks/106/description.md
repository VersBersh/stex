# MAIN: Add renderer-process logging or IPC log forwarding

## Summary
The structured file-based logging added in task 92 only covers the main process. Renderer-side errors (editor, UI) are not captured by the logging system. Renderer errors currently go to the DevTools console only and are lost when the window closes.

Either add a logger instance in the renderer process that forwards logs via IPC to the main-process logger, or implement another mechanism to capture renderer-side logs to the same log file.

## Acceptance criteria
- Renderer-process errors and warnings are captured in the structured log file
- Log entries from the renderer are distinguishable from main-process entries (e.g., via a source/process field)
- The solution does not introduce a tight coupling between renderer and main-process internals
- Existing main-process logging continues to work unchanged

## References
- Task 92 — the structured logging implementation this extends
- `src/renderer/` — renderer modules that currently lack logging
- Discovered in task 92
