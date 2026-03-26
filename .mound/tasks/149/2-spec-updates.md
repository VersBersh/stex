# Spec Updates

No spec updates required.

The spec (`spec/proposal-context-refresh.md`, "Audio ring buffer" section) already defines the ring buffer's API (`push`, `sliceFrom`, `clear`), lifecycle (created at session start, destroyed at session end), and integration point (`AudioCapture → RingBuffer → active WebSocket`). This task implements exactly what the spec describes for the routing step. No new contracts or changes to existing specs are needed.
