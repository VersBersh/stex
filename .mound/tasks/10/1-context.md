# Context for T10: Soniox WebSocket Client

## Relevant Files

| File | Role |
|------|------|
| `src/main/soniox.ts` | Target file — currently empty (`export {};`). Will contain the Soniox WebSocket client |
| `src/shared/types.ts` | Defines `SonioxToken`, `AppSettings`, `SessionState`, and other shared interfaces |
| `src/shared/ipc.ts` | IPC channel name constants used across main/renderer |
| `src/main/settings.ts` | Settings Store — provides `getSettings()` to read `AppSettings` including API key, model, language, etc. |
| `src/main/session.ts` | Session Manager — currently empty, will orchestrate soniox client (future task) |
| `src/main/audio.ts` | Audio Capture — currently empty, will stream PCM audio to soniox client (future task) |
| `src/main/settings.test.ts` | Existing test file — shows testing conventions (vitest, vi.mock, vi.hoisted pattern) |
| `spec/api.md` | Full Soniox WebSocket API specification — endpoint, config message, response format, token lifecycle, client-side processing, error handling |
| `spec/models.md` | Data model definitions including `SonioxToken` interface |
| `spec/architecture.md` | Architecture diagram showing Soniox Client responsibilities and data flow |
| `package.json` | Project deps — currently no `ws` package; uses vitest for tests |
| `webpack.main.config.js` | Webpack config for main process — externals for electron and electron-store |
| `vitest.config.ts` | Test config — includes `src/**/*.test.ts` |

## Architecture

The Soniox Client is a main-process component that:

1. **Connects** to `wss://stt.soniox.com/transcribe` via WebSocket
2. **Sends** a JSON configuration message on open (API key, model, audio format, sample rate, channels, language hints, max_endpoint_delay_ms)
3. **Receives** PCM audio chunks from Audio Capture and forwards them as binary WebSocket frames
4. **Parses** JSON responses containing token arrays with `audio_final_proc_ms` / `audio_total_proc_ms`
5. **Tracks** `audio_final_proc_ms` to identify new final tokens (those with `start_ms >= lastFinalProcMs`)
6. **Emits** events for new final tokens, non-final tokens, finished signal, and connection state changes
7. **Finalizes** by sending an empty binary frame, then waiting for `finished: true` response

Key constraints:
- Runs in Electron main process (Node.js) — needs `ws` package for WebSocket (browser WebSocket API not available)
- Config values come from Settings Store (`getSettings()`)
- Must be stateless between sessions — `lastFinalProcMs` resets on each connection
- Session Manager will call `connect()`, `sendAudio()`, `finalize()`, `disconnect()` — this module should be a clean, event-driven API
- No IPC in this module — Session Manager handles IPC forwarding to renderer
