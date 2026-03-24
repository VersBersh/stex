# Context

## Relevant Files

- `src/main/soniox.ts` — Soniox WebSocket client; config construction (lines 75-85), finalize method (lines 115-118)
- `src/main/soniox.test.ts` — Unit tests for SonioxClient; config assertion at lines 115-124

## Architecture

The Soniox subsystem handles real-time speech-to-text via a WebSocket connection. `SonioxClient` connects to the Soniox endpoint, sends a JSON config on open, streams PCM audio, and receives token responses. The config object at lines 75-85 specifies API key, model, audio format, language, and endpoint detection settings. The `finalize()` method sends an empty buffer to signal end-of-audio. The Soniox API requires `finalize_on_end: true` when `enable_endpoint_detection` and `max_endpoint_delay_ms` are set.
