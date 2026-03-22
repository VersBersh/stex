# T14: Inline Editing

## Summary

Enable users to edit committed text mid-document while transcription is actively streaming, with cursor preservation and the guarantee that user edits are never overwritten.

## Scope

- **Cursor behavior**:
  - Cursor tracks end of committed text by default (before ghost text)
  - As new final tokens are committed, cursor advances with them
  - When user clicks to reposition cursor mid-document, it stays put
  - Incoming tokens do not displace the user's cursor position or selection
  - When user moves cursor back to end, it resumes tracking
- **Edit protection**:
  - When user edits a soniox block, set `modified: true` on the affected EditorBlock
  - Modified blocks are never overwritten by incoming tokens
  - `source` stays `"soniox"` — only `modified` changes
- **Append anchor rule**:
  - Incoming transcription ALWAYS appends at the document tail, regardless of cursor position
  - User editing mid-document: tokens append at tail
  - User cursor elsewhere: tokens append at tail, cursor stays in place
- **Select all / Copy**: `Ctrl+A` / `Ctrl+C` include both user edits and transcribed text seamlessly

## Acceptance Criteria

- User can click anywhere in committed text and type corrections while streaming continues
- Incoming tokens do not displace the user's cursor
- Edited blocks are marked `modified: true` and never overwritten
- Copy and select-all include all text seamlessly
- Cursor resumes tracking when moved back to end

## References

- `spec/features/inline-editing.md` — full inline editing specification
- `spec/models.md` — EditorBlock ownership rules
