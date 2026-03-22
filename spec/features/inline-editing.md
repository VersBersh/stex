# Feature: Inline Editing / Correction

## Summary

Users can edit any part of the **committed** (finalized) text at any time — including while transcription is actively streaming — without losing new incoming text. Ghost text (non-final tokens) is read-only and cannot be edited.

## Behavior

### Cursor Position

- The cursor always tracks the end of committed text (just before ghost text)
- As new final tokens are committed, the cursor advances with them
- This positions the cursor at the most likely correction target — the most recently transcribed text
- The user can click anywhere to reposition the cursor for editing; it stays where they put it until they return to the end

### Editing Committed Text

- User clicks or navigates to any position within committed (final) text
- They type, delete, or select+replace as in any normal text editor
- User edits mark the affected block as `modified: true`, preventing any future overwrite by incoming tokens
- New final tokens from Soniox always append at the **document tail**, regardless of where the user's cursor is

### Editing During Active Transcription

- While the user is editing mid-document, new tokens still arrive
- Non-final ghost text continues to update at the document tail
- Final tokens always append at the **document tail** — never at the cursor position, never mid-document
- The user's cursor position and selection are preserved — incoming text does not shift their editing context
- When the user finishes editing and moves the cursor back to the end, it resumes tracking new tokens

### Append Anchor Rule

Incoming transcription always appends at the document tail. This is the single, canonical rule across all scenarios:
- User editing mid-document → tokens append at tail
- User typing at end → tokens append after typed text (which is at the tail)
- User cursor elsewhere → tokens still append at tail, cursor stays in place

### Ghost Text Interaction

- Ghost text (non-final tokens) is **read-only** — users cannot edit it directly since it will be replaced by Soniox
- If the user places their cursor at the very end (in the ghost text region), it snaps to just before the ghost text

### Pause-Edit-Resume Flow

The primary correction workflow:

1. User is speaking, sees an error in the transcribed text
2. User clicks **Pause** (or presses `Ctrl+P`) — see pause semantics below
3. User edits the error freely — no incoming tokens to worry about
4. User clicks **Resume** (or presses `Ctrl+P` again) — recording restarts, new transcription appends at document tail
5. This is all one session — the document accumulates until the window is hidden

This is simpler and more predictable than editing during active streaming, and will likely be the most common correction pattern.

### Pause Semantics

Pause is a single, well-defined state transition:

1. **Mic capture stops** — no more audio is sent to Soniox
2. **An empty audio frame is sent** to Soniox to trigger server-side finalization of any pending non-final tokens
3. **Wait for `finished: true`** — the app waits for Soniox to return the finalized response (this may take longer on slow connections, which is fine)
4. **Commit finalized tokens** — finalized tokens are committed as normal
5. **Ghost text is removed** — ghost text is cleared from the display
6. **Session state transitions to `"paused"`** — the WebSocket connection remains open

Resume reverses this: mic capture restarts, audio streaming resumes on the existing WebSocket, session state returns to `"recording"`.

## Design Principles

- Committed text is always fully editable — there is no "locked" or "dictation-only" mode (ghost text is the only read-only region)
- Transcription and editing are concurrent, not sequential (though pause-edit-resume is also supported)
- User edits always win over machine-generated text

## Acceptance Criteria

- User can click anywhere in committed text and type corrections
- Incoming tokens do not displace the user's cursor
- Edits persist — Soniox never overwrites user-modified text
- Copy/select-all includes both user edits and transcribed text seamlessly
