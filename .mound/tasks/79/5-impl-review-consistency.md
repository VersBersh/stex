**Verdict** — `Approved`

**Progress**
- [x] Done: Rewrote `classifyDisconnect` to use close-code-first classification with reason-text fallback in [src/main/error-classification.ts](C:/code/draftable/stex/.mound/worktrees/worker-4-7ddc34e5/src/main/error-classification.ts#L21).
- [x] Done: Updated the disconnect unit tests to cover the planned code-based and fallback paths in [src/main/error-classification.test.ts](C:/code/draftable/stex/.mound/worktrees/worker-4-7ddc34e5/src/main/error-classification.test.ts#L41).
- [x] Done: No caller changes were made; [src/main/session.ts](C:/code/draftable/stex/.mound/worktrees/worker-4-7ddc34e5/src/main/session.ts#L173) still passes `(code, reason)` unchanged, which matches the plan.

**Issues**
1. None.

The implementation matches the plan closely. The diff is limited to the two planned files, the classifier behavior is internally consistent with the intended two-tier design, and the updated tests cover the new decision paths called out in the plan. No unplanned changes or obvious regressions were visible from the caller/dependent code I reviewed. No tests or builds were run, per instruction.