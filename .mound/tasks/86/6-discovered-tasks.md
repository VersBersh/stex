# Discovered Tasks

1. **EDITOR: Migrate OverlayContext `$getRoot().getTextContent()` calls to shared helper**
   - `OverlayContext.tsx` has 3 remaining direct `$getRoot().getTextContent()` calls (isEmpty check at line 64, clipboard copy at line 102, sendSessionText at line 170)
   - These serve different purposes than the block-sync contract but could benefit from the same centralization
   - Discovered when cataloging all `$getRoot().getTextContent()` call sites during task 86 implementation
