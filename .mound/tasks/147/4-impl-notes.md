# Implementation Notes

## Files created

- `src/renderer/overlay/editor/tokenMerger.ts` — Pure token merging utility with `mergeTokens()` and `flushPending()` functions, plus `MergedToken` and `MergeResult` types
- `src/renderer/overlay/editor/tokenMerger.test.ts` — 16 unit tests for the merge functions

## Files modified

- `src/renderer/overlay/editor/TokenCommitPlugin.tsx` — Integrated token merger:
  - Added `pendingRef` to buffer partial words across batches
  - Extracted `commitWords(words: MergedToken[])` helper from inline commit logic
  - `onTokensFinal` now calls `mergeTokens()` and commits complete words only
  - Added `useEffect` for `onSessionPaused`/`onSessionStop` to flush pending
  - Added `registerClearHook` to discard pending buffer on clear
  - Uses `blockManager.commitFinalText()` instead of constructing fake SonioxToken objects
- `src/renderer/overlay/editor/editorBlockManager.ts` — Added `commitFinalText(text: string)` method; `commitFinalTokens` now delegates to it

## Deviations from plan

- **Clear semantics**: Plan review identified that flushing on clear was problematic (hook ordering, clear semantics). Changed to discard-on-clear: `pendingRef.current = []` without committing. This avoids ordering issues and matches the user intent of wiping everything.
- **commitFinalText**: Design review flagged semantic coupling from constructing fake `SonioxToken` objects in the adapter. Added `commitFinalText(text: string)` to the block manager as a clean interface boundary, removing the coupling.

## New tasks or follow-up work

None.
