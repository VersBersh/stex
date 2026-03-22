# Context

## Relevant Files

- `src/main/soniox.ts` — `SonioxClient` class that wraps the Soniox WebSocket connection. This is the class under test.
- `src/main/soniox.test.ts` — Existing unit tests for `SonioxClient` using mocked WebSocket. Provides test conventions and patterns.
- `src/shared/types.ts` — Defines `SonioxToken`, `AppSettings`, and other shared types.
- `src/main/settings.ts` — Exports `APP_SETTINGS_DEFAULTS` and `resolveSonioxApiKey()` — used to build settings objects for connecting.
- `src/main/logger.ts` — Structured file-based logger (`info`, `debug`, `warn`, `error`). The integration test imports from `soniox.ts` which uses the logger.
- `vitest.config.ts` — Current vitest config; includes `src/**/*.test.ts`. Integration tests need to be excluded from this pattern.
- `package.json` — Scripts section; needs a `test:integration` script added.

## Architecture

The `SonioxClient` class manages a WebSocket connection to the Soniox speech-to-text API (`wss://stt-rt.soniox.com/transcribe-websocket`). It:

1. Opens a WebSocket connection
2. Sends a JSON config message (API key, model, audio format, sample rate, language hints)
3. Accepts PCM audio chunks via `sendAudio(chunk: Buffer)`
4. Receives JSON responses containing `SonioxToken[]` arrays with `is_final` flags
5. Separates tokens into final and non-final, deduplicating finals using a `lastFinalProcMs` watermark
6. Signals end-of-stream via `finalize()` (sends empty buffer)
7. Receives `finished: true` in the final response

The existing unit tests mock the WebSocket entirely. There is no end-to-end test against the real Soniox API. The vitest config uses `src/**/*.test.ts` as the include pattern; integration tests can be excluded by using a different file naming pattern (e.g., `*.integration.test.ts`) and configuring a separate vitest project.
