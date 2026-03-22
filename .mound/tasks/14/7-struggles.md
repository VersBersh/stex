# T14: Struggles

## Planning-phase struggles (from plan review)

### 1. Lexical node-local vs document-global offsets

- **Category:** `spec-clarity`
- **What happened:** The initial plan used `anchor.offset` as if it were a document-global offset, but Lexical uses node-local offsets. Since each `onTokensFinal` call creates a new `TextNode` (appended to the paragraph), the document quickly has multiple TextNodes and the offset comparison was wrong. The plan review caught this.
- **What would have helped:** The spec or architecture doc could note that Lexical uses node-local offsets, and that the TokenCommitPlugin creates a new TextNode per token batch (not extending existing ones). This is a non-obvious implementation detail that significantly affects cursor detection logic.

### 2. Inline-typing vs inline-editing distinction

- **Category:** `spec-clarity`
- **What happened:** The initial plan routed all user edits through a single `applyEdit` path that would mark soniox blocks as modified. But typing at the document tail should create/extend `user` blocks per `inline-typing.md`, not modify the last soniox block. The plan review caught this conflation.
- **What would have helped:** The task description could explicitly call out the boundary with inline-typing behavior — "mid-document edits mark blocks modified, but tail typing follows the inline-typing spec." The two specs (inline-editing.md and inline-typing.md) describe adjacent but distinct behaviors without a clear cross-reference for the boundary between them.

### 3. Spec inconsistency in models.md rules 3 vs 4

- **Category:** `spec-clarity`
- **What happened:** Rule 3 in `spec/models.md` says "Each batch of finalized tokens creates a new block" while rule 4 says "Consecutive tokens from Soniox are merged into the same block." The implementation merges, so rule 3 is misleading. This was identified during review.
- **What would have helped:** Keeping spec rules consistent with implementation, or at least marking rules that describe the idealized model vs the actual merge behavior.

## Implementation-phase struggles

### 4. Worktree dependency installation

- **Category:** `tooling`
- **What happened:** The worktree had no `node_modules`. Running `npm install` failed due to native module (`naudiodon`) build errors. Had to use `--ignore-scripts` to get vitest working, which left Electron uninstalled — causing the pre-existing `soniox.test.ts` to fail on import.
- **What would have helped:** Pre-installed `node_modules` in worktrees (symlink or shared cache), or a worktree setup script that handles this.

### 5. TypeScript type checking unavailable

- **Category:** `tooling`
- **What happened:** `tsc --noEmit` produced hundreds of pre-existing JSX errors across the entire project (missing `--jsx` flag in tsconfig for direct tsc invocation). The project relies on webpack for building, not raw tsc. Could not get TypeScript-level verification of the new code.
- **What would have helped:** A working `typecheck` npm script or tsconfig configured for standalone `tsc --noEmit`.
