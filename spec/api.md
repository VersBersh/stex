# Soniox WebSocket API Integration

## Connection Lifecycle

The WebSocket connection is **opened when the window is shown** (session start) and **closed when the window is hidden** (session end). The connection is not kept alive across show/hide cycles. This is simple and predictable, and avoids paying for idle connections.

On pause, the WebSocket stays open (no audio is sent). On resume, audio streaming resumes on the same connection.

### Endpoint

```
wss://stt.soniox.com/transcribe
```

### Configuration Message

First message on the WebSocket must be a JSON configuration:

```json
{
  "api_key": "<SONIOX_API_KEY>",
  "model": "stt-rt-preview",
  "audio_format": "pcm_s16le",
  "sample_rate": 16000,
  "num_channels": 1,
  "language_hints": ["en"],
  "max_endpoint_delay_ms": 1000
}
```

### Audio Streaming

After configuration, send raw audio as binary WebSocket frames. Audio should be:
- PCM 16-bit signed little-endian
- 16kHz sample rate
- Mono channel
- Sent in chunks (e.g. every 100ms = 3200 bytes)

### Closing

Send an empty binary frame to signal end of stream. Server will finalize remaining tokens and send a `finished: true` response.

## Response Format

Each server message is JSON:

```json
{
  "tokens": [
    {
      "text": "Hello ",
      "start_ms": 120,
      "end_ms": 450,
      "confidence": 0.95,
      "is_final": true
    },
    {
      "text": "world",
      "start_ms": 460,
      "end_ms": 780,
      "confidence": 0.72,
      "is_final": false
    }
  ],
  "audio_final_proc_ms": 450,
  "audio_total_proc_ms": 780
}
```

## Token Lifecycle

```
Speaking: "How are you doing"

Response 1:  [("How're",  non-final)]
Response 2:  [("How are",  non-final)]
Response 3:  [("How are ", final), ("you", non-final)]
Response 4:  [("How are ", final), ("you doing", non-final)]
Response 5:  [("How are ", final), ("you doing", final)]
```

### Key rules:

1. **Non-final tokens are ephemeral** — each response replaces all previous non-final tokens
2. **Final tokens are permanent** — they appear once and are never re-sent or modified
3. **Responses contain both final and non-final tokens** — use `audio_final_proc_ms` to identify the boundary
4. **Final tokens accumulate** — track `audio_final_proc_ms` to know which final tokens are new since the last response

## Client-Side Processing

### On each WebSocket message:

```
1. Parse response
2. Filter out protocol markers (e.g. `<end>` endpoint detection tokens)
3. Separate final tokens (new ones only, based on audio_final_proc_ms advancing)
4. Commit new final tokens to the Lexical editor as EditorBlocks
5. Replace ghost text with current non-final tokens
```

### Tracking finalization progress:

```typescript
let lastFinalProcMs = 0;

function onMessage(response: SonioxResponse) {
  // Filter protocol markers (e.g. <end> from endpoint detection)
  const contentTokens = response.tokens.filter(t => t.text !== '<end>');
  const newFinalTokens = contentTokens.filter(
    t => t.is_final && t.start_ms >= lastFinalProcMs
  );
  const nonFinalTokens = contentTokens.filter(t => !t.is_final);

  if (newFinalTokens.length > 0) {
    commitToEditor(newFinalTokens);
    lastFinalProcMs = response.audio_final_proc_ms;
  }

  updateGhostText(nonFinalTokens);
}
```

## Error Handling

| Error | Handling |
|-------|----------|
| WebSocket disconnect | Stop mic capture immediately. Show "Disconnected" in status bar. Auto-reconnect with exponential backoff (1s, 2s, 4s, max 30s) — show "Reconnecting..." during attempts. **Do not buffer audio** during disconnect. Once reconnected, show "Reconnected" and wait for user to resume (click Resume or press `Ctrl+P`). Some audio will be lost during the outage — this is acceptable for v1. |
| Invalid API key | Show error in status bar, stop recording. Prompt user to check settings. |
| Rate limit / quota exceeded | Show error, stop recording. |
| Audio format mismatch | Should not happen if configured correctly. Log and alert. |

## Manual Finalization

Triggered on hide or pause. Send an empty binary frame to signal end-of-utterance. The server will finalize remaining tokens and respond with `finished: true`.

Wait for the `finished: true` response before proceeding. This may take longer on slow connections, which is acceptable — the user has already spoken the words and should get them.

**On hide**: After finalization completes, copy the full document text to clipboard, then hide the window and close the WebSocket.

**On pause**: After finalization completes, clear ghost text and enter the paused state. The WebSocket remains open for resume.
