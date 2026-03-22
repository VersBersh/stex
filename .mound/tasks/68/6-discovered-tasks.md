# Discovered Tasks — Task 68

1. **SESSION: Continue decomposition — extract IPC wiring and Soniox lifecycle from session.ts**
   - `session.ts` is still 389 lines after this extraction. Design review flagged it as still having too many concerns: IPC registration, Soniox lifecycle, session state transitions, clipboard behavior, overlay/window control.
   - Discovered because the design reviewer noted the file still violates Single Responsibility despite the extraction of error classification and reconnect policy.

2. **SESSION: Use WebSocket close code in classifyDisconnect instead of reason text only**
   - `classifyDisconnect(code, reason)` accepts `code` but only uses `reason` for classification. This creates semantic coupling to provider-specific reason strings.
   - Discovered because the design reviewer flagged unused `code` parameter and noted that classification by close code would be more robust.
