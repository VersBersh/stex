# MAIN: Expose log file path in settings UI

## Summary
Users may need to find log files for bug reports, but the log path is currently buried in the Electron userData directory with no way to discover it from the application. Add a way for users to locate or open the log file from the settings UI.

## Acceptance criteria
- The settings window displays the log file path or provides a button to open/reveal the log file location
- Users can easily copy the path or navigate to the log directory
- The displayed path stays in sync with the actual log file location

## References
- Task 92 — the structured logging implementation that created the log file
- Settings window UI (`src/renderer/settings/`)
- Discovered in task 92
