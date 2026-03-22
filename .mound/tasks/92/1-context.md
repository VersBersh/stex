# Context

## Relevant Files

- `src/main/logger.ts` — **to be created** — singleton logger module with log levels, file output, and console output
- `src/main/session.ts` — session manager; has `console.warn` for finalization timeout; needs lifecycle logging (start/stop/pause/resume, finalization sent/completed/timed out)
- `src/main/soniox-lifecycle.ts` — Soniox connection lifecycle; has 5 `console.error` calls; needs lifecycle logging (connect/disconnect, reconnect attempts, audio capture start/stop errors)
- `src/main/audio.ts` — audio capture module; no logging currently; needs logging for capture start/stop with device name
- `src/main/soniox.ts` — WebSocket client to Soniox; no logging currently; needs logging for WebSocket connect/disconnect with endpoint URL
- `src/main/index.ts` — app entry point; where logger initialization should be added early
- `src/main/settings.ts` — app settings (uses `electron-store`); potential source for log level configuration
- `src/main/reconnect-policy.ts` — reconnect delay calculation; referenced by lifecycle for reconnect timing
- `src/main/soniox-lifecycle.test.ts` — tests for lifecycle; mocks will need to remain compatible with logger changes
- `src/main/session.test.ts` — tests for session; mocks will need to remain compatible with logger changes
- `vitest.config.ts` — test configuration (vitest)
- `package.json` — dependencies; currently no logging library; may need `electron-log` or custom implementation

## Architecture

The app is an Electron tray-resident speech-to-text tool. The main process has a clear layered architecture:

1. **Entry** (`index.ts`) — boots the app, initializes all managers
2. **Session** (`session.ts`) — orchestrates transcription sessions (start/stop/pause/resume), manages state machine transitions, coordinates between Soniox lifecycle and UI
3. **Soniox Lifecycle** (`soniox-lifecycle.ts`) — manages the Soniox WebSocket connection lifecycle, reconnection logic, and audio capture coordination; delegates to `SonioxClient` and `audio.ts`
4. **Soniox Client** (`soniox.ts`) — low-level WebSocket client that connects to `wss://stt-rt.soniox.com/transcribe-websocket`, handles protocol (config, audio, finalization)
5. **Audio** (`audio.ts`) — PortAudio-based capture using `naudiodon`, streams PCM data via callbacks

Key constraints:
- All main process modules use CommonJS (`module: "commonjs"`)
- Tests use Vitest with heavy mocking of Electron and native modules
- No existing logging infrastructure — just 6 scattered `console.error`/`console.warn` calls in session.ts and soniox-lifecycle.ts
- The app uses `electron-store` for settings persistence; `app.getPath('userData')` is available for log file location
- Modules are structured as singletons with exported functions (not classes, except SonioxClient)
