# Context

## Relevant Files

| File | Role |
|------|------|
| `src/main/soniox.ts` | Manual WebSocket client for Soniox real-time STT API (~120 lines). Manages connection, config message, audio streaming, response parsing, and final/non-final token separation via `lastFinalProcMs` watermark. |
| `src/main/soniox.test.ts` | 21 unit tests for `SonioxClient`. Mocks the `ws` module with a custom `MockWebSocket` class. Tests config messages, audio sending, finalization, token parsing/dedup, stale socket protection, reconnect watermark reset, and error handling. |
| `src/main/soniox-lifecycle.ts` | Lifecycle manager that consumes `SonioxClient`. Handles connect, reconnect (with exponential backoff), audio capture coordination, and error classification. Passes `SonioxClientEvents` callbacks to the client. |
| `src/main/error-classification.ts` | `classifyDisconnect(code, reason)` uses raw WebSocket close codes (1000, 1001, 1006, 1008, 1011) and reason strings to decide if a disconnect is reconnectable and what `ErrorInfo` to surface. |
| `src/main/reconnect-policy.ts` | Exponential backoff policy for reconnection attempts. |
| `src/main/settings.ts` | Settings store providing `AppSettings` including `sonioxApiKey`, `sonioxModel`, `language`, `maxEndpointDelayMs`. |
| `src/shared/types.ts` | Shared types: `SonioxToken` (mirrors Soniox wire format), `AppSettings`, `SessionState`, `ErrorInfo`. |
| `spec/decisions.md` | Architecture decision log. Decision #3 documents using Soniox WebSocket API but doesn't mention the SDK. |
| `package.json` | Dependencies include `ws: ^8.18.0` (used by soniox.ts). No `@soniox/node` currently installed. |

## Architecture

The Soniox subsystem is a thin manual WebSocket client in the Electron main process:

1. **`SonioxClient`** creates a raw WebSocket to `wss://stt-rt.soniox.com/transcribe-websocket`, sends a JSON config message (api_key, model, audio_format, sample_rate, num_channels, language_hints, max_endpoint_delay_ms) on open, then streams raw PCM audio buffers and receives JSON responses.

2. **Token deduplication**: Each response contains ALL final tokens seen so far plus current non-final tokens. The client tracks `lastFinalProcMs` (from `final_audio_proc_ms` in the response) to filter already-seen final tokens and only emit genuinely new ones via `onFinalTokens`.

3. **Lifecycle management** is handled by `soniox-lifecycle.ts`, which:
   - Creates `SonioxClient` instances for initial connections and reconnection attempts
   - Coordinates audio capture (start on connect, stop on disconnect)
   - Classifies disconnects using raw WebSocket close codes via `classifyDisconnect()` to decide reconnectable vs terminal
   - Implements exponential backoff reconnection

4. **Error classification** (`classifyDisconnect`) depends on raw WebSocket close codes (RFC 6455):
   - Codes 1000, 1001, 1006, 1011 → reconnectable (network issues)
   - Code 1008 → parse reason string for auth/rate-limit
   - 4000-4999 → parse reason string, default reconnectable

5. **Stale socket protection**: The client compares socket identity (`socket !== this.ws`) to ignore events from superseded connections during reconnects.

The `@soniox/node` SDK (v1.1.2, Feb 2026) provides `SonioxNodeClient` → `client.realtime.stt(config)` → `RealtimeSttSession` with typed events (`connected`, `result`, `endpoint`, `finalized`, `finished`, `error`, `disconnected`). It is pure JS (no native deps), ~815 KB unpacked, supports `pcm_s16le`/16kHz/mono/language_hints/max_endpoint_delay_ms.
