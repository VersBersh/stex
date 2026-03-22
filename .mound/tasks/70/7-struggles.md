# Struggles

## 1. Discovering the text desync problem

- **Category**: description-quality
- **What happened**: The task description frames this as a `modified` flag synchronization issue. During analysis, I discovered that the block manager's **text** also desyncs from the editor on undo (not just the flag), and fixing only the flag while leaving the text desynced would create a worse bug. This required expanding the scope from "sync the modified flag" to "snapshot/restore full block state."
- **What would have helped**: The task description or a linked investigation note mentioning that the block manager text also diverges on undo. The phrase "currently safe behavior" in the description somewhat obscured the severity — the text desync means `UserTypingPlugin`'s `startsWith` check silently fails after undo, causing tail typing to stop being tracked.

## 2. Lexical history internals not readily accessible

- **Category**: orientation
- **What happened**: Understanding how Lexical's HistoryPlugin detects PUSH vs MERGE required reading the compiled source in `node_modules/@lexical/history/LexicalHistory.dev.mjs` from a sibling worktree, since node_modules wasn't installed in this worktree. The stack-top identity detection strategy required careful verification against the actual source.
- **What would have helped**: A spec section or decision doc describing the Lexical HistoryPlugin integration model — how the external `HistoryState` works, what PUSH/MERGE/DISCARD mean, and what tags undo/redo applies. This is a non-trivial integration point that multiple tasks depend on.
