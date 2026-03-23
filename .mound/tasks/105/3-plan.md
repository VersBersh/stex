# Plan

## Goal

Re-evaluate the `@soniox/node` SDK migration decision (Decision 7) against the original criteria and document the outcome.

## Steps

### Step 1: Gather SDK evidence

Check the current state of the `@soniox/node` SDK by querying the npm registry (`https://registry.npmjs.org/@soniox/node`). Record:
- Current latest version
- Number of releases and date range
- Whether a v2.x exists

Also verify the codebase-side revisit criteria:
- Check whether `classifyDisconnect()` in `error-classification.ts` still depends on raw WebSocket close codes
- Check whether the `lastFinalProcMs` watermark in `soniox.ts` still depends on raw `final_audio_proc_ms` from the WebSocket response

### Step 2: Assess each Decision 7 criterion

Compare findings from Step 1 against each of the four original concerns and three revisit triggers:

**Original concerns:**
1. Error classification dependency on raw close codes
2. Token deduplication uncertainty (`final_audio_proc_ms`)
3. SDK maturity (target: v2.x or 6+ months)
4. Low benefit-to-risk ratio (implementation is ~156 lines, 21 tests)

**Revisit triggers:**
1. SDK reaches v2.x or 6+ months of production usage
2. Soniox changes WebSocket protocol in a breaking way
3. Error classification refactored to not depend on raw close codes

### Step 3: Document the re-evaluation in `spec/decisions.md`

**File:** `spec/decisions.md`

Append a "Re-evaluation log" subsection to Decision 7 (after the "Revisit when" list). The text should:
- State the evaluation date and task ID
- Summarize findings with explicit source attribution (npm registry for SDK state, codebase grep for internal criteria)
- Record the decision (defer or migrate)
- Set the next re-evaluation target date

### Step 4: Record discovered follow-up task

Document a follow-up re-evaluation task in `6-discovered-tasks.md`, targeting ~Sep 2026 (6+ months after the SDK's initial Feb 2026 release).

## Risks / Open Questions

1. **This evaluation is early**: The target was ~Aug 2026, but we're performing it in Mar 2026. The next re-evaluation should be set to ~Sep 2026 to align with the 6-month production usage criterion.
