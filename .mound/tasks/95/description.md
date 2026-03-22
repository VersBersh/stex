# EDITOR: Migrate OverlayContext `$getRoot().getTextContent()` calls to shared helper

## Summary

`OverlayContext.tsx` has 3 remaining direct `$getRoot().getTextContent()` calls that were not migrated as part of the text serialization centralization (task 86). These calls serve different purposes than the block-sync contract but could benefit from the same centralized helper for consistency and maintainability:

1. **isEmpty check** (~line 64) — checks whether the editor has content
2. **Clipboard copy** (~line 102) — copies editor text to clipboard
3. **sendSessionText** (~line 170) — sends the full editor text to the session

Migrating these to the shared helper established in task 86 would eliminate direct `$getRoot().getTextContent()` usage from the overlay context, completing the centralization effort.

## Acceptance criteria

- All 3 `$getRoot().getTextContent()` calls in `OverlayContext.tsx` are replaced with the shared text serialization helper from task 86
- No direct `$getRoot().getTextContent()` calls remain in `OverlayContext.tsx`
- Existing behavior (isEmpty check, clipboard copy, sendSessionText) is preserved — no functional changes
- Existing tests continue to pass

## References

- Task 86: EDITOR: Centralize Lexical text serialization contract (established the shared helper)
- File: `src/renderer/overlay/OverlayContext.tsx`
