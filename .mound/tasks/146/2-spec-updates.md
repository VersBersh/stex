# Spec Updates — Task 146: Verbose logging for editor dirty-leaves tracking

No spec updates required from this task.

This task adds development/debug instrumentation only — verbose logging gated behind a flag that is disabled by default. It does not change any user-facing behavior, API contracts, data models, or architectural invariants.

**Note on `spec/models.md`**: Line 59 currently states the editor "uses standard `ParagraphNode` and `TextNode` types" and "avoids the complexity of custom Lexical node types." This conflicts with the `TimestampedTextNode` introduced by dependency Task 145, but updating that spec section is Task 145's responsibility — it introduces the custom node type. Task 146 only adds logging that observes whatever node types exist and does not require any spec changes of its own.
