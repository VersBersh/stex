# Implementation Notes

## Files created
- `src/renderer/overlay/editor/lexicalTextContract.ts` — New module exporting `LEXICAL_PARAGRAPH_SEPARATOR` constant and `$getDocumentText()` helper

## Files modified
- `src/renderer/overlay/editor/InlineEditPlugin.tsx` — Replaced `$getRoot` import with `$getDocumentText` import; replaced 2 call sites
- `src/renderer/overlay/editor/UserTypingPlugin.tsx` — Replaced `$getRoot` import with `$getDocumentText` import; replaced 1 call site
- `src/renderer/overlay/editor/UndoRedoBlockSyncPlugin.tsx` — Removed `$getRoot` from lexical import; added `$getDocumentText` import; replaced 2 call sites

## Deviations from plan
None.

## New tasks or follow-up work
- `OverlayContext.tsx` has 3 remaining `$getRoot().getTextContent()` calls (isEmpty, copy, sendSessionText). These serve different purposes than the block-sync contract and were intentionally excluded. Could be migrated in a follow-up if desired.
