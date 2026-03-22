# Spec Updates

## Spec changes required

### `spec/decisions.md` — New decision entry

**What needs to change:** Add a new decision entry documenting the evaluation of migrating to the `@soniox/node` SDK and the decision to defer migration.

**Why:** The task requires documenting the rationale if migration is not pursued. The evaluation found the migration is technically possible but not recommended due to:
1. Loss of raw WebSocket close codes needed by `classifyDisconnect()` for reconnection decisions
2. Uncertainty about `final_audio_proc_ms` field availability in SDK's `RealtimeResult` (critical for token dedup)
3. SDK maturity (v1.1.2, Feb 2026 — only ~1 month old)
4. Current implementation is small (~120 lines), stable, and well-tested (21 tests)

## New spec content

No new spec files needed. The decision entry in `spec/decisions.md` is sufficient.
