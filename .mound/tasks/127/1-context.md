# Context

## Relevant Files

- `src/main/index.ts` — App entry point; `initApp()` initializes all subsystems sequentially. No timing logs currently.
- `src/main/soniox.ts` — `SonioxClient` class managing WebSocket connection to Soniox STT API. `handleMessage()` (line 130) parses responses but only logs errors.
- `src/main/soniox-lifecycle.ts` — Lifecycle management for Soniox sessions (connect, reconnect, audio routing). `onAudioData()` (line 93) routes audio chunks with zero logging.
- `src/main/logger.ts` — Logger implementation with `debug`, `info`, `warn`, `error` functions. Writes to file + console. Level filtering via `LEVEL_PRIORITY`.
- `src/main/soniox.test.ts` — Unit tests for `SonioxClient`. Mocks `ws` and `./logger`.
- `src/main/soniox-lifecycle.test.ts` — Unit tests for lifecycle module. Mocks `SonioxClient`, audio, settings, and logger.

## Architecture

The app is an Electron tray-resident app for live speech-to-text. At startup, `initApp()` initializes subsystems in sequence: logger, settings IPC, audio IPC, theme, window, session, tray, hotkey. The Soniox subsystem uses a WebSocket client (`SonioxClient`) wrapped by a lifecycle manager (`soniox-lifecycle.ts`) that handles connect/disconnect/reconnect and audio capture routing.

Logging uses a simple custom logger (`logger.ts`) with four levels (debug/info/warn/error) and printf-style formatting via Node's `util.format`. All existing tests mock `./logger` so adding debug calls won't affect test behavior.
