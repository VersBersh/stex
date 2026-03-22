# Feature: Inline Typing During Dictation

## Summary

Users can pause speaking to type text directly into the editor — such as technical terms, paths, or symbols that are difficult to dictate — and then seamlessly resume speaking. New transcription appends after the typed content.

## Motivation

Some text is impractical to dictate: file paths (`~/.gitignore`), code symbols (`useState`), URLs, or domain-specific jargon. Rather than dictating a placeholder and fixing it later, users should be able to type it inline and keep going.

## Behavior

### Flow

1. User is speaking — final tokens are being committed, ghost text is updating
2. User stops speaking to type — silence triggers Soniox endpoint detection, current utterance finalizes, ghost text clears
3. User types directly into the editor — typed text becomes a user-owned `EditorBlock` (never overwritten by Soniox)
4. User resumes speaking — new final tokens append after the typed content, ghost text reappears at the document tail

### Example

> **Speaking**: "edit the" → finalized as committed text
> **Typing**: `~/.gitignore` → inserted as user-owned block
> **Speaking**: "file to exclude node modules" → appended as new committed text
>
> **Result**: "edit the ~/.gitignore file to exclude node modules"

### Interaction Details

- No explicit pause/resume action is needed — the user simply stops speaking and starts typing
- Soniox endpoint detection fires during the natural silence while typing, finalizing the current utterance
- The editor cursor is at the end of the document (after committed text, before ghost text), so typed characters insert at the right position
- When the user starts speaking again, new tokens always append at the **document tail** (not at the cursor position)

### Block Boundary Rules

When the user types at the end of the document (after the last committed block):
- If the previous block is `source: "user"`, extend it with the new characters
- If the previous block is `source: "soniox"`, create a new block with `source: "user"`

When the user types in the middle of the document (editing existing text), see [inline-editing](inline-editing.md) — no new blocks are created, the existing block is marked `modified: true`.

When new finalized tokens arrive from Soniox:
- If the last block is `source: "soniox"` and `modified: false`, extend it
- Otherwise, create a new block with `source: "soniox"`

This produces an alternating sequence of blocks by source when the user interleaves typing and speaking.

### Whitespace Handling

Soniox tokens include their own whitespace (e.g. `"How are "` with a trailing space). When a user types text at the document tail and then resumes speaking:
- The user is responsible for any trailing whitespace after their typed text
- The next Soniox token will have its own leading/trailing whitespace as determined by the Soniox model
- No automatic whitespace is inserted at the boundary between user-typed and transcribed text

### Limitations

- Soniox has no awareness of the typed text. Its language model cannot use typed content as context for predicting adjacent words. In practice this has minimal impact on transcription quality since Soniox processes audio independently.
- Keyboard sounds during typing may occasionally be picked up by the microphone. Soniox generally handles this well as background noise.

## Acceptance Criteria

- Typed text is preserved as a user-owned block and never overwritten by incoming tokens
- New transcription after typing appends at the document tail (after the typed content)
- No explicit pause/resume is required to switch between speaking and typing
- The transition between spoken and typed text is seamless in the final document
