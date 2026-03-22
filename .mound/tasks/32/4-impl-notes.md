# Implementation Notes

## Files modified

- `spec/features/system-tray.md` — Updated first-run condition from "no `settings.json` exists or no API key configured" to "no API key available" with cross-reference to effective settings spec. Updated hotkey message condition to use "available" instead of "configured."
- `src/main/first-run.test.ts` — Added test case documenting that env-var-resolved API keys skip the first-run API key prompt.

## Deviations from plan

None. The plan was followed exactly.

## New tasks or follow-up work

None discovered.
