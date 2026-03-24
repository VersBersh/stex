# Plan

## Goal

Add debug-level diagnostic logging to three areas — startup timing, Soniox message handling, and audio data flow — to make transcription issues diagnosable from logs alone.

## Steps

### 1. Startup timing in `src/main/index.ts`

- Import `debug` from `./logger`
- Capture `const t0 = performance.now()` at the very top of `initApp()`, before `initLogger()`
- After `initLogger()` + `registerLogIpc()`, log: `debug('initApp: logger initialized (%.0fms)', performance.now() - t0)`
- After each subsequent init step, log with cumulative elapsed time:
  - `debug('initApp: settings IPC registered (%.0fms)', performance.now() - t0)`
  - `debug('initApp: audio IPC registered (%.0fms)', performance.now() - t0)`
  - `debug('initApp: theme manager initialized (%.0fms)', performance.now() - t0)`
  - `debug('initApp: window manager initialized (%.0fms)', performance.now() - t0)`
  - `debug('initApp: session manager initialized (%.0fms)', performance.now() - t0)`
  - `debug('initApp: tray initialized (%.0fms)', performance.now() - t0)`
  - `debug('initApp: hotkey manager initialized (%.0fms)', performance.now() - t0)`
- Note: The first `debug()` call can only happen after `initLogger()` sets the level. The entry timestamp is captured via `performance.now()` before init, then reported in the first log line.

### 2. Soniox config logging in `src/main/soniox.ts`

- In the `socket.on('open')` handler (line 64-91), replace the existing partial config log (lines 87-88) with a debug log of the full config object excluding `api_key` and `context` (which may contain up to 9000 chars of user content):
  ```
  const { api_key: _, context: ctx, ...safeConfig } = config;
  debug('Soniox config: %j context_length=%d', safeConfig, ctx?.text?.length ?? 0);
  ```

### 3. Soniox message logging in `src/main/soniox.ts`

- In `handleMessage()` (line 130), after the token processing logic (after line 156, before the `finished` check), add a debug log summarizing the response:
  ```
  debug('Soniox msg: tokens=%d final=%d non-final=%d finished=%s',
    contentTokens.length, newFinalTokens.length, nonFinalTokens.length, !!response.finished);
  ```

### 4. Audio data flow logging in `src/main/soniox-lifecycle.ts`

- Add a module-level chunk counter variable: `let audioChunkCount = 0;`
- In `onAudioData()` (line 93), increment the counter and log every 100 chunks at debug level. Compute dB independently for the logged chunk (the purpose is diagnostic confirmation that audio is flowing, regardless of whether `levelMonitor`/`onAudioLevel` are active):
  ```
  audioChunkCount++;
  if (audioChunkCount % 100 === 0) {
    const logDb = computeDbFromPcm16(chunk);
    debug('Audio flow: chunks=%d size=%d dB=%.1f', audioChunkCount, chunk.length, logDb);
  }
  ```
- Reset `audioChunkCount = 0` in `resetLifecycle()` and at the start of `connectSoniox()`.

### 5. Verify

- Run `npm test` to confirm all existing tests pass (logger is mocked in all relevant test files).
- Run build to confirm no compilation errors.

## Risks / Open Questions

- **Performance**: `performance.now()` and periodic (every 100 chunks) dB computation are negligible overhead.
- **Log volume**: All new logging is at `debug` level, which is only enabled in dev mode (`app.isPackaged ? 'info' : 'debug'`).
- **Test impact**: All test files for affected modules already mock `./logger`, so debug calls are no-ops in tests.
- **Pre-init logging**: The first log line can only be emitted after `initLogger()`. The entry timestamp is captured before init and reported in the first debug message, so no timing data is lost.
