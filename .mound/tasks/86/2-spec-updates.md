# Spec Updates

No spec updates required. This task is a pure implementation refactor that centralizes existing `$getRoot().getTextContent()` calls into a shared helper. The paragraph separator contract is already documented in `spec/models.md` (line 61), which describes the `\n\n` separator behavior and its relationship to `$getRoot().getTextContent()`. This task does not change that contract — it makes the code match the spec's intent by centralizing the dependency.
