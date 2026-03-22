# Implementation Notes

## Files modified

- `src/renderer/overlay/OverlayContext.tsx` — Added import of `$getDocumentText` from `./editor/lexicalTextContract`; replaced 3 `$getRoot().getTextContent()` calls (lines 65, 103, 171) with `$getDocumentText()`. Kept `$getRoot` import for the existing `.clear()` usage on line 54.

## Deviations from plan

None.

## New tasks or follow-up work

None discovered.
