# Spec Updates

## Spec changes required

### `spec/models.md` — EditorBlock "Mapping to Lexical" subsection

**What needs to change**: Add a paragraph documenting that paragraph boundaries are represented as newline characters within block text, matching Lexical's `$getRoot().getTextContent()` output (currently `\n\n`).

**Why**: The current spec describes block text as plain concatenation with no mention of paragraph separators. With multi-paragraph support, blocks may contain `\n\n` characters representing Lexical paragraph boundaries. This should be documented so future readers understand that newlines in block text are intentional and correspond to Lexical's `ParagraphNode` boundaries.

**Verified**: `ElementNode.getTextContent()` in `node_modules/lexical/Lexical.dev.js` line 9058 adds `DOUBLE_LINE_BREAK = '\n\n'` between non-inline element children.

**Proposed addition** (append to "Mapping to Lexical" subsection, before "### Undo/Redo Scope"):

> Paragraph boundaries in Lexical (multiple `ParagraphNode` children of the root) are represented as newline characters within block text, matching the separator returned by Lexical's `$getRoot().getTextContent()` (currently `\n\n`). When a user splits or joins paragraphs, these characters are inserted or removed via the standard `applyEdit` mechanism — no special handling is needed. The block manager's offset model (character-level) naturally accounts for them as regular characters.

## New spec content

None required.
