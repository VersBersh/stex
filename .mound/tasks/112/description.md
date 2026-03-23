# EVAL: Re-evaluate @soniox/node SDK migration (~Sep 2026)

## Summary

Re-evaluate Decision 7 (manual WebSocket implementation vs `@soniox/node` SDK). By Sep 2026 the SDK will have been available for ~7 months, meeting the 6-month production usage threshold from the revisit criteria. Check the current SDK version, release activity, documentation maturity, and community adoption. Re-assess all four original concerns (stability, feature completeness, documentation quality, community adoption).

This is a follow-up to task 105, which performed the scheduled re-evaluation in Mar 2026 but found all revisit criteria unmet (SDK still v1.1.2, only ~1.5 months old at the time). The evaluation was deferred to Sep 2026 to allow the SDK to mature.

## Acceptance criteria

- Check current `@soniox/node` SDK version and release history since Mar 2026
- Assess documentation maturity (API reference, migration guides, examples)
- Evaluate community adoption (npm downloads, GitHub issues/stars, production usage reports)
- Re-assess the four original concerns from Decision 7 against updated data
- Produce a written evaluation with a clear recommendation: migrate, defer again (with next date), or close permanently
- If recommending migration, create follow-up implementation tasks

## References

- `.mound/tasks/105/description.md` — Previous re-evaluation (deferred from Aug to Sep 2026)
- `.mound/tasks/91/description.md` — Original SDK evaluation task
- `spec/decisions/007-soniox-sdk-vs-manual-websocket.md` — Decision record
