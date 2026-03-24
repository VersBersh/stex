# Add diagnostic logging: startup timing, Soniox messages, audio data flow

## Summary

The current logging has significant gaps that made debugging transcription failures much harder than necessary. Several key code paths produce no log output at all, making it impossible to tell from logs whether audio is flowing, whether Soniox is responding, or what's slow at startup.

## Acceptance criteria

### Startup timing
- `initApp()` in `src/main/index.ts` logs a timestamp at entry and after each major init step (settings, audio, window, session, tray, hotkey) so startup delays can be attributed to a specific step

### Soniox message logging
- `handleMessage()` in `src/main/soniox.ts:130` logs a debug-level summary of each successful response: token count, final token count, non-final token count, and whether `finished` flag is set
- The full Soniox config object (excluding `api_key`) is logged at debug level when sent, not just model/language/max_endpoint_delay_ms

### Audio data flow logging
- `onAudioData()` in `src/main/soniox-lifecycle.ts:93` logs periodically (e.g. every 100 chunks or every few seconds) at debug level: chunk count, chunk size, and computed dB — enough to confirm audio is flowing without flooding the log

### General
- All new logging is at `debug` level to avoid noise in production
- Existing tests pass

## References

- `src/main/index.ts` — app init, no timing logs before first `initSessionManager()` call
- `src/main/soniox.ts:130` — `handleMessage()` only logs errors
- `src/main/soniox-lifecycle.ts:93` — `onAudioData()` has zero logging
- `src/main/logger.ts` — logger implementation
