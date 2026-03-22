# T13: Token Commit & EditorBlock Management

## Summary

Implement the logic that commits finalized tokens from Soniox into the Lexical editor and maintains the `EditorBlock[]` data structure that tracks text ownership and modification state.

## Scope

- Listen for `tokens:final` IPC messages in the overlay renderer
- Commit final token text to the Lexical editor at the document tail (programmatic append)
- Maintain an `EditorBlock[]` alongside the Lexical editor state:
  - Each batch of final tokens creates or extends a soniox-owned block
  - Block boundary rules from `spec/models.md`:
    - If last block is `source: "soniox"` and `modified: false`, extend it
    - Otherwise, create a new block with `source: "soniox"`, `modified: false`
  - Track block boundaries by character offset ranges
- **Undo/redo scope**: programmatic appends are NOT part of the Lexical undo history — Ctrl+Z never removes transcription output
- Coordinate with Ghost Text Plugin: when final tokens arrive, ghost text for the same content is removed (the non-final tokens that preceded these finals)

## Acceptance Criteria

- Final tokens are appended to the editor as permanent text
- `EditorBlock[]` correctly tracks blocks with source, modified status, and offsets
- Consecutive soniox tokens extend the same block (no unnecessary fragmentation)
- Programmatic appends are excluded from undo history
- Block boundaries are maintained correctly as text is added

## References

- `spec/models.md` — `EditorBlock` interface, ownership rules, mapping to Lexical, undo/redo scope
- `spec/api.md` — client-side processing of final tokens
- `spec/features/realtime-transcription.md` — token commit flow
