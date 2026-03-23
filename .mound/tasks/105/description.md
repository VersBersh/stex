# EVAL: Re-evaluate @soniox/node SDK migration (~Aug 2026)

## Summary
Task 91 evaluated migrating the Soniox integration from the raw WebSocket client to the official `@soniox/node` SDK and decided against it (Decision 7). The "Revisit when" criteria specify re-evaluation after the SDK has 6+ months of production usage or reaches v2.x. Target timeframe is approximately August 2026.

This is a follow-up reminder task to perform that re-evaluation.

## Acceptance criteria
- Check the current state of `@soniox/node` SDK (version, production adoption, feature completeness)
- Re-assess against the original evaluation criteria from task 91
- Document decision to migrate or defer again with updated rationale
- If migrating, create implementation tasks for the migration

## References
- Task 91 evaluation and Decision 7
- `src/main/soniox.ts` — current raw WebSocket implementation
- Discovered in task 91
