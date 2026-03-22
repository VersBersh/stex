# Implementation Notes — Task 79

## Files modified
- `src/main/error-classification.ts` — rewrote `classifyDisconnect` to use close code as primary signal with reason text fallback. Extracted `classifyByReason` helper to eliminate duplication between the 1008 and application-code paths. Made 1008 non-reconnectable by default.
- `src/main/error-classification.test.ts` — restructured tests into code-based and reason-text-fallback groups, added new test cases for 1000, 1001, 1011, 1008, and code-precedence behavior.

## Deviations from plan
- **1008 handling**: The original plan (pre-review) let 1008 fall through to reason text with a reconnectable default. The design review correctly flagged this as a hidden coupling risk. Revised to make 1008 non-reconnectable by default, using reason text only to refine the error subtype (api-key vs unknown).
- **`classifyByReason` helper**: Extracted to eliminate duplication between 1008 and Tier 2 classification. Not in the original plan but follows naturally from the 1008 fix.

## New tasks or follow-up work
None discovered.
