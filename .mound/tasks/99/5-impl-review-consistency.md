- **Verdict** — `Approved`

- **Progress**
  - [x] Step 1 — Done: `<end>` filtering was added at the Soniox service boundary in [src/main/soniox.ts#L7](C:/code/draftable/stex/.mound/worktrees/worker-4-836c2e15/src/main/soniox.ts#L7) and applied before final/non-final separation in [src/main/soniox.ts#L133](C:/code/draftable/stex/.mound/worktrees/worker-4-836c2e15/src/main/soniox.ts#L133).
  - [x] Step 2 — Done: the four planned unit tests were added under `endpoint marker filtering` in [src/main/soniox.test.ts#L415](C:/code/draftable/stex/.mound/worktrees/worker-4-836c2e15/src/main/soniox.test.ts#L415).
  - [x] Step 3 — Done: the client-side processing docs and pseudocode were updated in [spec/api.md#L89](C:/code/draftable/stex/.mound/worktrees/worker-4-836c2e15/spec/api.md#L89).

- **Issues**
  1. None.

Implementation matches the plan, keeps the fix at the correct protocol boundary, and does not introduce any visible downstream regression in the token consumers I checked. Review was done by code inspection only, per instruction.