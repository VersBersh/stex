# Implementation Notes

## Files created or modified

| File | Summary |
|------|---------|
| `spec/decisions.md` | Appended re-evaluation log entry to Decision 7 recording the Mar 2026 assessment and deferral |

## Evidence gathered

**npm registry** (`https://registry.npmjs.org/@soniox/node`):
- Latest version: 1.1.2
- Total releases: 4 (v1.0.0 Feb 9, v1.1.0 Feb 17, v1.1.1 Feb 19, v1.1.2 Feb 24)
- No releases in ~1 month since Feb 24
- No v2.x release

**Codebase verification**:
- `error-classification.ts:48-65` — `classifyDisconnect()` still switches on raw WebSocket close codes (1000, 1001, 1006, 1008, 1011)
- `soniox.ts:36,135,141` — `lastFinalProcMs` watermark still depends on `final_audio_proc_ms` from raw WebSocket response
- `soniox.ts` — still ~156 lines, same implementation as at task 91

## Deviations from the plan

None.

## New tasks or follow-up work

1. **EVAL: Re-evaluate @soniox/node SDK migration (~Sep 2026)** — Next scheduled re-evaluation of Decision 7. By Sep 2026 the SDK will have been available for ~7 months, meeting the 6-month production usage threshold. Check for v2.x release, expanded documentation, and community adoption.
