# Discovered Tasks

1. **RT: Replace pending-flush timer with explicit endpoint signal**
   - Surface Soniox `<end>` markers as a renderer-side event to provide a protocol-based flush trigger instead of the current 300ms timeout heuristic.
   - Discovered because: the design review flagged the timer as a temporal coupling to Soniox batch cadence. An explicit signal would be architecturally cleaner but requires cross-process IPC changes.

2. **RT: Refactor TokenCommitPlugin — extract pending buffer management**
   - Extract pending-buffer/timer orchestration into a focused hook to reduce file size (now 316 lines) and improve single-responsibility adherence.
   - Discovered because: the design review flagged the growing file size and repeated timer-clear patterns across multiple handlers.
