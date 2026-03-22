# Struggles — T13

## 1. Lexical undo history bypass
- **Category:** missing-context
- **What happened:** Determining how to bypass Lexical's undo history for programmatic appends required reading the HistoryPlugin source code directly (`@lexical/history/LexicalHistory.dev.mjs`). The Lexical docs don't document the `'historic'` tag behavior or how to selectively exclude updates from undo. The plan went through multiple incorrect approaches before landing on the correct one.
- **What would have helped:** A spec note or code comment documenting the intended undo bypass mechanism, or a spike/proof-of-concept done before the task was created. Also, having node_modules pre-installed in the worktree would have saved the npm install step.

## 2. Block manager-editor state synchronization
- **Category:** description-quality
- **What happened:** The task description says to "maintain an EditorBlock[] alongside the Lexical editor state" but doesn't specify how to keep the two in sync when the editor is cleared or when sessions start/stop. Both code reviews flagged this as a major issue. The fix (adding `registerClearHook` to OverlayContext) was straightforward but wasn't anticipated in the original plan.
- **What would have helped:** The task description could explicitly list integration points: "wire block manager clear to editor clear", "wire block manager reset to session lifecycle". Or the task could have been scoped more tightly to just token commit + block creation, with a separate task for lifecycle synchronization.
