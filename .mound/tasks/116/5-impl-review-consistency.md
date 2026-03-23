**Verdict** — `Approved`

**Progress**
- [x] Done — Step 1: add post-render overflow guard to ghost-text scroll-follow logic in [GhostTextPlugin.tsx](/C:/code/draftable/stex/.mound/worktrees/worker-2-5acd5e32/src/renderer/overlay/editor/GhostTextPlugin.tsx#L11)
- [x] Done — Step 2: apply the same overflow guard to final-token auto-scroll in [TokenCommitPlugin.tsx](/C:/code/draftable/stex/.mound/worktrees/worker-2-5acd5e32/src/renderer/overlay/editor/TokenCommitPlugin.tsx#L137)

**Issues**
1. None.

The implementation matches the plan exactly. The only code changes are the two planned overflow guards, and both are placed at the correct post-mutation scroll points: [GhostTextPlugin.tsx](/C:/code/draftable/stex/.mound/worktrees/worker-2-5acd5e32/src/renderer/overlay/editor/GhostTextPlugin.tsx#L25) and [TokenCommitPlugin.tsx](/C:/code/draftable/stex/.mound/worktrees/worker-2-5acd5e32/src/renderer/overlay/editor/TokenCommitPlugin.tsx#L135). I did not find any unplanned changes in `git diff HEAD`.

The change is logically sound: it preserves the existing `wasNearBottom` behavior, adds the missing `overflow > 0` condition, and does not affect plugin wiring in [Editor.tsx](/C:/code/draftable/stex/.mound/worktrees/worker-2-5acd5e32/src/renderer/overlay/editor/Editor.tsx#L49). Regression risk looks low because callers/dependents are unchanged and the new condition only suppresses scrolling when the container does not actually overflow. Residual risk is limited to runtime layout behavior, which the plan already identified as requiring manual verification rather than code-only validation.