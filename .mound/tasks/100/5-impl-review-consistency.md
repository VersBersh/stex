- **Verdict** — `Needs Fixes`

- **Progress**
  - `done` Step 1: `cursorAtEnd` was hoisted out of the `editor.update()` callback in [TokenCommitPlugin.tsx](C:/code/draftable/stex/.mound/worktrees/worker-1-e89472be/src/renderer/overlay/editor/TokenCommitPlugin.tsx#L60).
  - `partially done` Step 2: scroll-after-commit logic was added in [TokenCommitPlugin.tsx](C:/code/draftable/stex/.mound/worktrees/worker-1-e89472be/src/renderer/overlay/editor/TokenCommitPlugin.tsx#L123), but it checks “near bottom” after the DOM has already grown.
  - `partially done` Step 3: ghost-text scroll logic was added in [GhostTextPlugin.tsx](C:/code/draftable/stex/.mound/worktrees/worker-1-e89472be/src/renderer/overlay/editor/GhostTextPlugin.tsx#L14), with the same post-update bottom check issue.

- **Issues**
  1. **Major** — The new auto-scroll can fail exactly when the user is already at the bottom and a single update adds more than 50px of height. In [TokenCommitPlugin.tsx](C:/code/draftable/stex/.mound/worktrees/worker-1-e89472be/src/renderer/overlay/editor/TokenCommitPlugin.tsx#L125) and [GhostTextPlugin.tsx](C:/code/draftable/stex/.mound/worktrees/worker-1-e89472be/src/renderer/overlay/editor/GhostTextPlugin.tsx#L15), `nearBottom` is computed from the post-update `scrollHeight`. If the append/wrap itself increases height past the 50px threshold, the condition becomes false and the container does not scroll, even though the user was at the bottom before the update. That misses the plan goal: “keep the latest content visible when the user is already viewing the bottom.”  
     Suggested fix: capture `wasNearBottom` from the container before `editor.update(...)` / `handleNonFinalTokens(...)`, then perform the actual `scrollTop = scrollHeight` after the mutation when `wasNearBottom` is true (and, for final tokens, still gate on `cursorAtEnd`).

No unplanned changes were introduced beyond the two planned files.