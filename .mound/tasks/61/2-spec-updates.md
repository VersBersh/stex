# Spec Updates

No spec updates required.

The `GhostText` model in `spec/models.md` already describes ghost text as ephemeral — "it gets replaced with every new Soniox response." The implementation fix (clearing ghost text on final token arrival) is consistent with this spec. The spec doesn't prescribe implementation details about when exactly the CSS property is cleared, so this is purely a code-level coordination fix.
