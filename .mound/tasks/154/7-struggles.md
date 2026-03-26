# Struggles — Task 154: Replay Ghost Regions

## 1. Ring buffer chunk-boundary semantics
- **Category:** missing-context
- **What happened:** The plan initially assumed `sliceFrom(ms)` returns audio starting exactly at `ms`, but the actual API returns from the last chunk with `startMs <= ms`. This was caught by the plan review and required adding `sliceFromWithMeta` and adjusting `connectionBaseMs` to use the actual start timestamp. Understanding the ring buffer's chunk-level granularity required reading the implementation.
- **What would have helped:** A docstring on `sliceFrom` explicitly stating it returns from the chunk boundary, not the exact timestamp. Or the `AudioRingBuffer` class could have included `sliceFromWithMeta` from the start, making the boundary behavior self-documenting.

## 2. SonioxClient silent audio drop
- **Category:** missing-context
- **What happened:** The plan initially included a code path that sent replay audio before the WebSocket was connected, not realizing `SonioxClient.sendAudio` silently drops data when `!this.connected`. This was caught by the plan review.
- **What would have helped:** A comment on `sendAudio` documenting the drop behavior, or a return value/warning when audio is dropped.

## 3. Deep dependency chain across planned-but-unimplemented tasks
- **Category:** orientation
- **What happened:** This task depends on 4 other tasks (149, 150, 152, 153), two of which are still in planning. Understanding the full API surface required reading all four task plans plus the spec. The cross-task coordination (who sets `connectionBaseMs`, who calls `reconnectWithContext`, where callbacks are wired) required careful tracking.
- **What would have helped:** A dependency graph or interface contract document that shows the expected API surface for each task without needing to read the full plans. Something like a `CONTRACTS.md` listing exported functions and their signatures across tasks in the pipeline.
