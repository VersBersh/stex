# Spec Updates

No spec updates required. This is a mechanical refactoring that replaces direct `$getRoot().getTextContent()` calls with an existing shared helper (`$getDocumentText()`). No interfaces, contracts, or APIs change — only the internal call site is updated for consistency.
