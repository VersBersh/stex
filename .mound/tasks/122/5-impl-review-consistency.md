- **Verdict** — `Approved`
- **Progress**
  - [x] Step 1: Update `spec/api.md` with explicit 5-second timeout and graceful degradation. Done.
  - [x] Step 2: Update `spec/features/inline-editing.md` pause semantics with timeout details and API cross-reference. Done.
  - [x] Step 3: Update `spec/features/realtime-transcription.md` ending flow with timeout details and API cross-reference. Done.
  - [x] Step 4: Update `spec/features/text-output.md` clipboard flow with timeout details and API cross-reference. Done.

The implementation matches the plan exactly: the diff only touches the four planned spec files, and the wording is consistent with the actual behavior in the codebase. `src/main/session.ts` uses `FINALIZATION_TIMEOUT_MS = 5000` and proceeds after timeout, while the WebSocket remains open on pause and late final tokens can still be forwarded via the existing `onFinalTokens` / `onFinished` flow in `src/main/soniox-lifecycle.ts` and `src/main/soniox.ts`. I did not identify correctness, completeness, regression, or code-quality issues in the submitted changes.