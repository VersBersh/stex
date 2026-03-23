# Feature: Real-Time Transcription

## Summary

Stream microphone audio to the Soniox WebSocket API and display transcribed text in the editor as it arrives, distinguishing between provisional (non-final) and confirmed (final) tokens.

## Behavior

### Starting a Session

- User presses the global hotkey to show the window
- Microphone capture begins (or resumes if pre-connected)
- A WebSocket connection to Soniox is established (or already open if kept alive)
- When starting with existing text (append mode), the preceding editor text is sent as context to Soniox to improve transcription continuity
- Audio frames are streamed continuously to Soniox

### Token Flow

1. **Non-final tokens** arrive first — displayed as "ghost text" at the end of the document
2. Non-final tokens **update in place** as Soniox refines its hypothesis
3. When Soniox is confident, tokens become **final** — they are committed into the editor as permanent text
4. The ghost text region always sits after all committed text
5. While ghost text is updating, the cursor auto-tracks the end of committed text (per-event position check — see inline-editing spec for the cursor-at-end contract)

### Ending a Session

- User presses the hotkey again to hide the window
- Session enters `"finalizing"` state:
  1. Mic capture stops
  2. An empty audio frame is sent to Soniox to trigger finalization
  3. App waits for the `finished: true` response (may take a moment on slow connections)
  4. Finalized tokens are committed as normal, ghost text is removed
  5. Full document text is copied to clipboard (if non-empty)
  6. Window hides

## Edge Cases

- **Network interruption**: Stop mic capture, show "Reconnecting..." in status bar. Auto-reconnect with exponential backoff. **Do not buffer audio** — some speech will be lost during the outage. Once reconnected, the user must explicitly resume. This is the v1 behavior; audio buffering may be added in a future version.
- **Silence**: Soniox endpoint detection fires after a pause (configurable 500ms–3000ms), finalizing the current utterance. No special handling needed.
- **Long sessions**: Soniox supports up to 300 minutes per stream. For longer sessions, transparently reconnect. Note: very long documents may degrade Lexical editor performance — consider this a practical limit for v1.

## Acceptance Criteria

- Non-final tokens visually update without flickering
- Final tokens never change once committed to the editor

### Performance Goals

These are aspirational targets, not hard requirements. They assume a stable network connection and reasonable system load:

- Text appears within 500ms of speaking
- Session start-to-first-word latency is under 1 second
