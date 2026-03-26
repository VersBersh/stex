# Spec Updates — Task 153: Capture pendingStartMs at pause time

## Spec changes required

No spec changes are required.

The `pendingStartMs` concept is already fully specified in `spec/proposal-context-refresh.md`:

- **Step 6** of the "High-level flow" describes how `pendingStartMs` is captured from the first unfinalized token and combined with `replayStartMs`.
- The **"What changes where" → `soniox-lifecycle.ts`** section explicitly lists: "Capture and persist `pendingStartMs` at pause time if unfinalized tokens exist."
- The **"What changes where" → `session.ts`** section describes: "Combines renderer replay analysis with main-process pending-audio state to determine the effective replay start."
- The `effectiveReplayStartMs` formula is already specified.

The spec describes the contract clearly — this task implements it. No new spec content or amendments are needed.

## New spec content

None required.
