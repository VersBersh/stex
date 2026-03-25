# Spec Updates

## Spec changes required

### `spec/models.md` — Mapping to Lexical section (line 57-61)

**What needs to change**: The "Mapping to Lexical" section currently states: "The Lexical editor uses standard `ParagraphNode` and `TextNode` types" and "This avoids the complexity of custom Lexical node types." This needs to be updated to reflect that committed transcription text now uses `TimestampedTextNode` (a `TextNode` subclass) to carry per-token audio timing metadata.

**Why**: The task explicitly introduces `TimestampedTextNode` as a custom Lexical node type. The existing spec language would be contradicted by the implementation. The custom node is a lightweight subclass that renders identically to `TextNode` — it only adds metadata fields. The block manager offset model is unchanged; blocks are still tracked by character offsets independent of Lexical node boundaries.

**Proposed change**: Update the first sentence of the "Mapping to Lexical" section to acknowledge that committed transcription text uses `TimestampedTextNode` nodes (a `TextNode` subclass carrying `startMs`, `endMs`, and `originalText` metadata), while the block manager remains offset-based and independent of Lexical node structure. Add a note that `TimestampedTextNode` renders identically to `TextNode` and that timestamp metadata may become stale after user edits (which is expected — edited nodes can be detected by comparing current text to `originalText`).

## New spec content

None.
