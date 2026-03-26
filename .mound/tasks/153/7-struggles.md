# Struggles — Task 153

## 1. Frozen vs. live state semantics

- **Category:** spec-clarity
- **What happened:** The task description's acceptance criterion "Late-arriving final tokens during pause may clear/update the pending state appropriately" was ambiguous — it could mean either clearing the frozen snapshot or clearing the live tracking variable. The plan reviewer correctly flagged that the spec's "persists it across the handoff" language contradicts clearing on finalization. Understanding why the snapshot must be frozen (finalized tokens used old context, may still need replay) required tracing through the full replay purpose.
- **What would have helped:** The task description could have been more explicit: "Late-arriving final tokens clear the live tracking state (`lastNonFinalStartMs`) but do NOT clear the captured `pendingStartMs` snapshot."

## 2. Session test architecture mismatch

- **Category:** missing-context
- **What happened:** Initially assumed session tests would mock `soniox-lifecycle`, but `session.test.ts` uses the real lifecycle module with mocked lower-level dependencies. The plan reviewer caught this. Had to revise the test strategy to use observable state (`getPendingStartMs()`) instead of mock assertions.
- **What would have helped:** A note in the task description or context about the test architecture — specifically that session tests are integration-style tests using real lifecycle.
