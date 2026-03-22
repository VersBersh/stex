# Discovered Tasks

1. **SPEC: Fix api.md endpoint mismatch with soniox.ts**
   - `spec/api.md` documents endpoint `wss://stt.soniox.com/transcribe` but `src/main/soniox.ts` uses `wss://stt-rt.soniox.com/transcribe-websocket`. The spec needs to match the implementation (which was updated in commit `28928de`).
   - Discovered when reviewing spec consistency during SDK evaluation.

2. **SPEC: Add missing SessionState values to models.md**
   - `spec/models.md` does not include `disconnected` or `reconnecting` in the `SessionState` status union, but `src/shared/types.ts` defines them. These were added by the reconnection feature.
   - Discovered when the plan reviewer flagged spec drift.

3. **EVAL: Re-evaluate @soniox/node SDK migration (~Aug 2026)**
   - Per Decision 7's "Revisit when" criteria, re-evaluate after the SDK has 6+ months of production usage or reaches v2.x.
   - Discovered as a follow-up from this evaluation task.
