# T14: Spec Updates — Inline Editing

## Spec changes required

### 1. `spec/features/inline-editing.md` — Add cursor tracking behavior

**What needs to change:** The spec describes cursor behavior at a high level ("cursor tracks end of committed text", "stays where they put it") but does not specify how the system determines whether the cursor is "at the end" vs "mid-document." This distinction drives the implementation.

**Addition needed:** A new subsection under "### Cursor Position":

```markdown
### Cursor Tracking Behavior

When new tokens are committed and appended at the document tail:
- If the cursor is currently at the end of committed text (on or after the last character of the last text node), it advances with the new text — this is the default tracking behavior
- If the cursor is anywhere else (mid-document), it stays in place — the token append does not move it

The determination of "at end" is made at the moment tokens arrive, by checking whether the selection's anchor is on the last text node in the last paragraph and its offset equals the node's text length. This is a per-event check, not persistent state.

When the user moves the cursor back to the end of committed text (e.g., Ctrl+End, clicking after the last character), subsequent token commits resume advancing the cursor.
```

**Why:** Specifies the observable behavior (cursor stays or advances) and the decision criterion (is the cursor on the last text node at its end?) without mandating a specific implementation mechanism like a boolean flag. The "per-event check" approach is simpler than maintaining a separate tracking flag that could drift out of sync.

### 2. `spec/models.md` — Add edit detection rule distinguishing mid-document edits from tail typing

**What needs to change:** The ownership rules describe what `modified: true` means but don't specify the operation that sets it or how it interacts with tail typing (which creates `user` blocks per `inline-typing.md`).

**Addition needed:** Under "### Ownership Rules", add:

```markdown
5. **Detecting mid-document edits**: The block manager tracks cumulative character offsets for each block. When a user-initiated text change occurs (excluding programmatic `'historic'`-tagged updates), the block manager determines whether the edit is at the document tail or within existing text:
   - **Tail insertion** (edit offset equals total document length): creates or extends a `source: "user"` block per the inline-typing block boundary rules
   - **Mid-document edit** (edit offset < total document length): maps the offset to the affected block(s); if a block has `source: "soniox"` and `modified: false`, sets `modified: true`; updates block `text` to reflect the edit
   - **Cross-block edits** (select+replace spanning multiple blocks): all affected blocks are marked `modified: true` and the replacement text is applied to the first affected block; fully consumed subsequent blocks are removed
```

**Why:** The existing spec conflates two distinct operations: editing existing text (which marks blocks modified) and typing at the tail (which creates user blocks). The inline-typing spec already defines tail typing behavior. This rule explicitly separates the two paths and clarifies cross-block semantics.

### 3. `spec/features/inline-editing.md` — Clarify selection preservation as a requirement

**What needs to change:** The spec says "incoming text does not shift their editing context" but doesn't specify the mechanism or expected behavior precisely.

**Addition needed:** Under "### Editing During Active Transcription":

```markdown
#### Selection Preservation

When new tokens are appended at the document tail while the user has a cursor or selection mid-document:
- The cursor/selection position must remain unchanged — the same characters surround the cursor before and after the append
- Since tokens are appended after the user's cursor position, the implementation must save the current selection before appending and restore it afterward if the cursor was not at the document tail
- This is a hard requirement, not a guarantee from the editor framework — the token commit plugin is responsible for implementing save/restore
```

**Why:** The previous draft incorrectly claimed Lexical naturally preserves selections. The review correctly identified that the task exists precisely because this doesn't happen automatically. The spec should state this as a requirement, not a framework guarantee.

### 4. `spec/models.md` — Fix inconsistency between rules 3 and 4

**What needs to change:** Rule 3 says "Each batch of finalized tokens from Soniox creates a new block" while rule 4 says "Consecutive tokens from Soniox are merged into the same block." The implementation merges (rule 4), so rule 3 is misleading.

**Change needed:** Reword rule 3:

```markdown
3. **Incoming tokens extend or create blocks**: Each batch of finalized tokens from Soniox extends the last block if it is `source: "soniox"` and `modified: false`. Otherwise, a new block with `source: "soniox"`, `modified: false` is created.
```

And simplify rule 4 to only cover alternation:

```markdown
4. **Block alternation**: Blocks alternate by source at boundaries. When the user types after a soniox block, a new user block starts. When new tokens arrive after a user block or a modified soniox block, a new soniox block starts.
```

**Why:** Aligning the spec with the actual merge behavior in `editorBlockManager.ts:20-30` prevents confusion for future implementers.

## New spec content

No new spec files are needed. All changes are additions/edits to existing spec files.
