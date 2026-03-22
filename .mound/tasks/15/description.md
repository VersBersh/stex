# T15: Inline Typing

## Summary

Enable users to type text directly into the editor during dictation (e.g., technical terms, file paths, symbols) with typed text preserved as user-owned blocks that interleave with transcribed content.

## Scope

- When the user types at the document tail (after the last committed block):
  - If previous block is `source: "user"`, extend it
  - If previous block is `source: "soniox"`, create a new block with `source: "user"`
- When new finalized tokens arrive from Soniox after user typing:
  - Create a new block with `source: "soniox"` (since last block is now user-owned)
  - This produces an alternating sequence of blocks by source
- **No explicit pause/resume needed**: natural silence while typing triggers Soniox endpoint detection, finalizing the current utterance
- **Whitespace handling**: no automatic whitespace inserted at user/soniox block boundaries — user is responsible for trailing whitespace after typed text, Soniox handles its own leading whitespace
- Ghost text reappears at document tail when the user resumes speaking

## Acceptance Criteria

- Typed text is preserved as a user-owned block, never overwritten by incoming tokens
- New transcription after typing appends at the document tail (after typed content)
- No explicit pause/resume is required to switch between speaking and typing
- Block boundaries alternate correctly when interleaving speech and typing
- The transition between spoken and typed text is seamless in the final document

## References

- `spec/features/inline-typing.md` — full inline typing specification
- `spec/models.md` — EditorBlock ownership rules, block boundary rules
