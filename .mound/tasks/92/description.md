# Add structured file-based logging with log levels

## Summary

The app currently uses scattered `console.error`/`console.warn` calls with no persistent log files, no log levels, and no way to review logs after the fact. This makes debugging production issues (connection failures, audio problems, finalization timeouts) extremely difficult.

Add a proper logging system to the main process that supports configurable log levels, writes to a log file on disk, and replaces the existing ad-hoc console calls.

## Acceptance criteria

- [ ] Create a logger module (`src/main/logger.ts`) that supports log levels: `debug`, `info`, `warn`, `error`
- [ ] Log output is written to a file in the app's user data directory (e.g., `{app.getPath('userData')}/logs/stex.log`)
- [ ] Log entries include timestamp, level, and message
- [ ] Log level is configurable (default: `info` in production, `debug` in development)
- [ ] Log file rotation or size management to prevent unbounded growth (e.g., max file size or retain last N runs)
- [ ] Replace all existing `console.error`/`console.warn` calls in the main process with logger calls:
  - `src/main/session.ts` — finalization timeout warning
  - `src/main/soniox-lifecycle.ts` — Soniox errors, audio capture errors, reconnect errors
- [ ] Add logging at key lifecycle points:
  - Session start/stop/pause/resume
  - Soniox WebSocket connect/disconnect (include endpoint URL)
  - Audio capture start/stop (include device name)
  - Reconnect attempts (include attempt number and delay)
  - Finalization sent/completed/timed out
- [ ] Logs are also written to the console (stdout/stderr) so they remain visible when running from a terminal

## Approach

Keep it simple — a lightweight custom logger or a minimal dependency (e.g., `electron-log`). Avoid heavy frameworks. The logger should be importable as a singleton from any main-process module.

## References

- `src/main/session.ts` — current `console.warn` usage
- `src/main/soniox-lifecycle.ts` — current `console.error` usage
- `src/main/audio.ts` — audio capture (no logging currently)
- `src/main/soniox.ts` — WebSocket client (no logging currently)
