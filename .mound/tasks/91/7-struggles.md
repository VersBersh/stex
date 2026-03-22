# Struggles

## 1. SDK documentation gaps
- **Category**: missing-context
- **What happened**: The `@soniox/node` SDK docs pages were spread across multiple URLs, some returned 404s, and the type reference didn't include full field definitions for `RealtimeResult` (only a summary: "Batch message with token array and audio processing milliseconds"). This made it impossible to confirm whether `final_audio_proc_ms` is preserved in the SDK's result events — a critical detail for the token dedup logic.
- **What would have helped**: A single comprehensive API reference page for the SDK with all type definitions expanded, or the ability to install the package and inspect its `.d.ts` files directly.

## 2. npm page blocked
- **Category**: tooling
- **What happened**: The npmjs.com package page returned 403 when fetched via WebFetch. Had to use the npm registry API (`registry.npmjs.org`) instead, which provided metadata but not the README or detailed usage examples.
- **What would have helped**: A working fetch of the npm page, or a tool to run `npm info @soniox/node` directly.
