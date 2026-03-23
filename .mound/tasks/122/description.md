# SPEC: Add finalization timeout details to feature specs

## Summary
`spec/api.md` was updated (in task 103) to document the 5-second finalization timeout and graceful degradation behavior for the Soniox WebSocket protocol. However, several feature specs that reference the same protocol behavior (waiting for `finished: true`) do not mention this timeout or degradation behavior, creating a minor inconsistency.

The following feature specs need updating:
- `spec/features/inline-editing.md`
- `spec/features/realtime-transcription.md`
- `spec/features/text-output.md`

Each should reference or describe the 5-second finalization timeout and graceful degradation behavior consistently with `spec/api.md`.

## Acceptance criteria
- `spec/features/inline-editing.md` references the finalization timeout behavior documented in `spec/api.md`
- `spec/features/realtime-transcription.md` references the finalization timeout behavior documented in `spec/api.md`
- `spec/features/text-output.md` references the finalization timeout behavior documented in `spec/api.md`
- All references are consistent with the timeout details in `spec/api.md`

## References
- `spec/api.md` — source of truth for the 5-second finalization timeout behavior
- Task 103 — original task that updated `spec/api.md`
- `.mound/tasks/103/6-discovered-tasks.md` — discovery source
