# SESSION: Extract clipboard behavior from session.ts

## Summary
Extract `waitForClipboardText()` and the clipboard-write logic in `stopSession` (~30 lines) into a dedicated clipboard integration module. Clipboard handling is a distinct concern from session lifecycle management.

This is the next largest isolated concern remaining in session.ts after the IPC wiring and Soniox lifecycle extractions completed in task 78.

## Acceptance criteria
- Clipboard-related functions (`waitForClipboardText`, clipboard-write in `stopSession`) are extracted to a dedicated module
- session.ts imports and delegates to the new clipboard module
- No behavioral changes — existing clipboard functionality works identically
- Existing tests continue to pass

## References
- Discovered during task 78 (SESSION: Extract IPC wiring and Soniox lifecycle from session.ts)
- .mound/tasks/78/6-discovered-tasks.md (item 1)
- Related: task 68 (SESSION: Decompose session.ts into focused modules)
