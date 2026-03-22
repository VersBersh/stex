# Discovered Tasks — Task 78

1. **SESSION: Extract clipboard behavior from session.ts**
   - `waitForClipboardText()` and clipboard-write logic in `stopSession` (~30 lines) are a distinct concern (clipboard integration) that could be its own module.
   - Discovered because after extracting IPC and Soniox lifecycle, clipboard is the next largest isolated concern remaining in session.ts.

2. **SESSION: Extract renderer communication helpers**
   - `sendToRenderer`, `sendStatus`, `sendError` are used across session.ts and passed as callbacks to soniox-lifecycle. A dedicated module would make the communication boundary explicit.
   - Discovered during implementation when the lifecycle callbacks bridge between soniox-lifecycle events and renderer messaging.
