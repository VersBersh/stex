# T10: Soniox WebSocket Client

## Summary

Implement the Soniox WebSocket client in the main process that connects to the Soniox streaming API, sends audio frames, and receives/parses token responses.

## Scope

- Create `src/main/soniox.ts`
- **Connection**:
  - Connect to `wss://stt.soniox.com/transcribe`
  - Send JSON configuration message on connect (API key, model, audio format, sample rate, channels, language hints, max_endpoint_delay_ms — all from Settings Store)
- **Audio streaming**:
  - Accept PCM audio chunks and send as binary WebSocket frames
  - `sendAudio(chunk: Buffer)` method
- **Token parsing**:
  - Parse JSON responses from Soniox
  - Track `audio_final_proc_ms` to identify new final tokens vs previously seen ones
  - Separate final tokens from non-final tokens
  - Emit events: `onFinalTokens(tokens: SonioxToken[])`, `onNonFinalTokens(tokens: SonioxToken[])`
- **Finalization**:
  - `finalize()` — send empty binary frame to trigger server-side finalization
  - Detect `finished: true` response
  - Emit `onFinished()` event
- **Lifecycle**:
  - `connect()` / `disconnect()` methods
  - Emit connection state events (connected, disconnected, error)

## Acceptance Criteria

- Connects to Soniox WebSocket and sends configuration
- Audio chunks are sent as binary frames
- Token responses are parsed and separated into final/non-final
- `audio_final_proc_ms` tracking correctly identifies new final tokens
- Empty frame finalization triggers and `finished: true` is detected
- Connection lifecycle is clean (connect/disconnect without leaks)

## References

- `spec/api.md` — full WebSocket API specification, token lifecycle, client-side processing
- `spec/models.md` — `SonioxToken` interface
- `spec/architecture.md` — Soniox Client responsibilities
