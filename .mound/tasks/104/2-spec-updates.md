# Spec Updates Required

## Change: Add `disconnected` and `reconnecting` to `SessionState.status` in `spec/models.md`

**File:** `spec/models.md`

**What needs to change:** The `SessionState` interface's `status` field union type on line 95 currently lists 6 values (`idle`, `connecting`, `recording`, `paused`, `finalizing`, `error`). It needs to include `disconnected` and `reconnecting` to match the authoritative definition in `src/shared/types.ts`.

**Why:** The reconnection feature added these two status values to the implementation but the spec was not updated. The spec should be the single source of truth for the data model contract.
