# Soniox WebSocket API Integration

## Connection Lifecycle

The WebSocket connection is **opened when the window is shown** (session start) and **closed when the window is hidden** (session end). The connection is not kept alive across show/hide cycles. This is simple and predictable, and avoids paying for idle connections.

On pause, the WebSocket stays open (no audio is sent). On resume, audio streaming resumes on the same connection.

### Endpoint

```
wss://stt-rt.soniox.com/transcribe-websocket
```

### Configuration Message

First message on the WebSocket must be a JSON configuration:

```json
{
  "api_key": "<SONIOX_API_KEY>",
  "model": "stt-rt-v4",
  "audio_format": "pcm_s16le",
  "sample_rate": 16000,
  "num_channels": 1,
  "language_hints": ["en"],
  "enable_endpoint_detection": true,
  "max_endpoint_delay_ms": 1000
}
```

`model` is configurable via settings; `stt-rt-v4` is the current default. `language_hints` and `max_endpoint_delay_ms` are also configurable.

### Context (Optional)

When the editor contains existing text (e.g., when starting with `onShow: 'append'`), a `context` object is included in the configuration message to help Soniox produce more accurate transcription as a continuation of the existing text:

```json
{
  "api_key": "...",
  "model": "stt-rt-preview",
  "context": {
    "text": "The preceding editor text goes here..."
  },
  "audio_format": "pcm_s16le",
  ...
}
```

- `context.text`: The text currently in the editor before the new dictation begins
- Maximum ~10,000 characters (Soniox limit of 8,000 tokens); the implementation drops the oldest prefix and keeps the most recent 9,000 characters
- Only included when there is non-empty editor text at session start
- On reconnect within the same session, the context from the initial connect is reused

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
  "final_audio_proc_ms": 450,
  "total_audio_proc_ms": 780
}
```

### Response fields

| Field | Type | Description |
|-------|------|-------------|
| `tokens` | array | List of recognized tokens |
| `final_audio_proc_ms` | number | Milliseconds of audio finalized so far |
| `total_audio_proc_ms` | number | Total milliseconds of audio processed |
| `finished` | boolean? | `true` when all pending tokens have been finalized (sent after empty-frame signal). Always accompanied by `tokens` (may be empty). |
| `error_code` | string? | Error code from the server |
| `error_message` | string? | Human-readable error description |

### Token fields

| Field | Type | Description |
|-------|------|-------------|
| `text` | string | The recognized text |
| `start_ms` | number | Start time in the audio stream |
| `end_ms` | number | End time in the audio stream |
| `confidence` | number | Confidence score (0.0 - 1.0) |
| `is_final` | boolean | `true` = finalized, `false` = ephemeral |
| `speaker` | string? | Optional speaker identifier (multi-speaker scenarios) |

### Error responses

The server may send an error response instead of tokens:

```json
{
  "error_code": "invalid_api_key",
  "error_message": "The provided API key is not valid"
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
2. **Final tokens may be re-sent** — the server can include previously-finalized tokens in subsequent responses. The client must deduplicate them.
3. **`is_final` determines token class** — each token's `is_final` field determines whether it is finalized or ephemeral
4. **`final_audio_proc_ms` is a deduplication watermark** — track the last-seen `final_audio_proc_ms` value. Final tokens with `start_ms >= lastFinalProcMs` are new; others have already been processed.
5. **Endpoint markers are protocol-internal** — tokens with `text === '<end>'` are endpoint detection markers and must be filtered out before processing

## Client-Side Processing

### On each WebSocket message:

```
1. Parse response
2. Check for error responses (error_code field)
3. Skip responses with no tokens field
4. Filter out protocol markers (tokens with text === '<end>')
5. Identify new final tokens (is_final && start_ms >= lastFinalProcMs)
6. Commit new final tokens to the transcript
7. Update lastFinalProcMs watermark from final_audio_proc_ms
8. Update ghost text (see branching logic below)
9. Handle finished signal if present
```

### Tracking finalization progress:

```typescript
let lastFinalProcMs = 0;

function onMessage(response: SonioxResponse) {
  if (response.error_code) {
    handleError(response.error_code, response.error_message);
    return;
  }

  if (!response.tokens) return;

  // Filter protocol markers (e.g. <end> from endpoint detection)
  const contentTokens = response.tokens.filter(t => t.text !== '<end>');
  const newFinalTokens = contentTokens.filter(
    t => t.is_final && t.start_ms >= lastFinalProcMs
  );
  const nonFinalTokens = contentTokens.filter(t => !t.is_final);

  if (newFinalTokens.length > 0) {
    commitFinalTokens(newFinalTokens);
    lastFinalProcMs = response.final_audio_proc_ms;
  }

  // Ghost text update branching:
  // - If there are non-final tokens, replace ghost text with them
  // - If all tokens were protocol markers (no finals, no non-finals),
  //   clear ghost text (emit empty array)
  // - If response is all-final with no non-finals, do NOT clear ghost text
  if (nonFinalTokens.length > 0) {
    updateGhostText(nonFinalTokens);
  } else if (newFinalTokens.length === 0 && response.tokens.length > 0) {
    updateGhostText([]);  // all tokens were markers — clear stale ghost text
  }

  if (response.finished) {
    handleFinished();
  }
}
```

## Error Handling

### Server error responses

When the server sends a response with `error_code` and `error_message` fields, the client stops processing and reports the error.

### WebSocket disconnect classification

On disconnect, the close code determines whether to reconnect:

| Close Code | Meaning | Reconnectable | Notes |
|------------|---------|---------------|-------|
| 1000 | Normal closure | No (default) | Refined by reason text |
| 1001 | Going away | Yes | Server shutting down |
| 1006 | Abnormal closure | Yes | Network failure |
| 1008 | Policy violation | No | Refined by reason text |
| 1011 | Internal server error | Yes | Server-side error |
| Other / 4000-4999 | Application-defined | Yes (default) | Refined by reason text |

**Reason text refinement** — for codes that support it (1000, 1008, and the fallback), the close reason is inspected:
- Contains "api key", "unauthorized", or "authentication" → non-reconnectable, API key error
- Contains "rate limit", "quota", or "too many" → non-reconnectable, rate limit error
- Otherwise → use the default for that code

### Reconnect behavior

On a reconnectable disconnect:
- Stop audio capture immediately
- Schedule reconnect with exponential backoff: 1s, 2s, 4s, 8s, ..., max 30s
- **Do not buffer audio** during disconnect
- On successful reconnect, transition to **paused** state (user must manually resume)

On a non-reconnectable disconnect:
- Stop audio capture immediately
- Show error to user (API key error → prompt to check settings, rate limit → show limit message)

### Audio capture errors

| Error | Type | Handling |
|-------|------|----------|
| Access denied / permission / microphone access denied | `mic-denied` | Show error, prompt user to grant access in system settings |
| Device not found / unavailable | `mic-unavailable` | Show error |

## Manual Finalization

Finalization sends an empty binary frame to signal end-of-utterance. The server will finalize remaining tokens and respond with `finished: true`. The client waits for this response before proceeding, with a **5-second timeout** to prevent hangs. If the timeout expires, the client proceeds anyway (graceful degradation).

**On pause**: Always sends finalization. After finalization completes, clear ghost text and enter the paused state. The WebSocket remains open for resume.

**On stop (hide)**: Finalization is **conditional** — only sent if the WebSocket is connected and there are pending non-final tokens. After finalization (or if skipped), optionally copy document text to clipboard (when the `onHide` setting is `clipboard`), then hide the window and close the WebSocket.

**On quick dismiss (Escape)**: Skips finalization entirely — stops audio capture, closes WebSocket, and hides the window immediately.
