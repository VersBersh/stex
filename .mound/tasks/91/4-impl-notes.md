# Implementation Notes

## Files created or modified

| File | Summary |
|------|---------|
| `spec/decisions.md` | Added Decision 7: "Manual WebSocket over @soniox/node SDK for Soniox Integration" — documents the SDK evaluation and rationale for deferring migration. |

## Verification

Tests verified: `npx vitest run src/main/soniox.test.ts` — 21 passed (0 failed), duration 1.82s.

## Deviations from the plan

None.

## New tasks or follow-up work

1. **Spec drift: `spec/api.md` endpoint mismatch** — `spec/api.md` documents endpoint `wss://stt.soniox.com/transcribe` but `src/main/soniox.ts` uses `wss://stt-rt.soniox.com/transcribe-websocket`. One of these needs updating (likely the spec, given recent commit `28928de` updated the endpoint).

2. **Spec drift: `spec/models.md` missing SessionState values** — `spec/models.md` does not include `disconnected` or `reconnecting` in the `SessionState` status union, but `src/shared/types.ts` defines them. The spec should be updated to match.

3. **Re-evaluate SDK after stabilization** — Per Decision 7's "Revisit when" criteria, the `@soniox/node` SDK should be re-evaluated once it reaches v2.x or has 6+ months of production usage (around Aug 2026).
