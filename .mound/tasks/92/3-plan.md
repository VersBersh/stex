# Plan

## Goal

Add a lightweight structured file-based logger (`src/main/logger.ts`) with log levels, file rotation, and console mirroring, then replace all existing `console.error`/`console.warn` calls and add lifecycle logging throughout the main process.

## Steps

### 1. Create `src/main/logger.ts` — the logger module

Create a custom logger (no external dependencies) as a singleton module exporting named functions: `debug()`, `info()`, `warn()`, `error()`, and `initLogger()`.

**Design:**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { format } from 'util';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3,
};

const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

let logStream: fs.WriteStream | null = null;
let currentLevel: LogLevel = 'info';

export function initLogger(opts: { logDir: string; level?: LogLevel }): void
export function debug(message: string, ...args: unknown[]): void
export function info(message: string, ...args: unknown[]): void
export function warn(message: string, ...args: unknown[]): void
export function error(message: string, ...args: unknown[]): void
```

**Format:** `[ISO-8601 timestamp] [LEVEL] formatted_message\n` — uses `util.format()` to support `%s`, `%d`, `%j` placeholders (matching Node/console conventions).

**File output:** Write to `{logDir}/stex.log` using `fs.createWriteStream` in append mode.

**Rotation:** On `initLogger`, check if existing log file exceeds `MAX_LOG_SIZE_BYTES` (5 MB). If so, rename it to `stex.log.1` (overwriting any previous `.1`). Simple 1-file rotation capped at ~10 MB total.

**Re-initialization:** `initLogger()` closes any previously opened stream before opening a new one. This makes repeated calls safe (including in tests).

**Console mirroring:** Each log call also writes to `console.log` (for debug/info) or `console.error` (for warn/error) so output is visible in terminal.

**Level default:** Accept level as a parameter. The caller (`index.ts`) will pass `'debug'` in dev and `'info'` in production based on `app.isPackaged`.

**Graceful fallback:** If `fs.mkdirSync` or `fs.createWriteStream` fails, the logger operates in console-only mode (no crash).

### 2. Create `src/main/logger.test.ts` — tests for the logger

Test `initLogger`, log level filtering, file writing, format-string interpolation, rotation, re-initialization (closes previous stream), console output, and graceful fallback when directory creation fails.

Use temporary directories (`fs.mkdtempSync` with `os.tmpdir()`) so tests don't depend on Electron. Spy on `console.log`/`console.error` to verify console mirroring.

### 3. Initialize logger in `src/main/index.ts`

In `initApp()`, call `initLogger()` before any other initialization:

```typescript
import * as path from 'path';
import { initLogger } from './logger';
// ...
export function initApp(): void {
  const logDir = path.join(app.getPath('userData'), 'logs');
  initLogger({ logDir, level: app.isPackaged ? 'info' : 'debug' });
  // ... rest of init
}
```

### 4. Replace `console.warn` in `src/main/session.ts`

Import `{ info, warn }` from `./logger`.

- **Line 26:** Replace `console.warn('Finalization timed out after %dms, proceeding anyway', timeoutMs)` with `warn('Finalization timed out after %dms, proceeding anyway', timeoutMs)`

Add lifecycle logging:
- `startSession()`: `info('Session starting')`
- `pauseSession()`: `info('Session pausing')`
- `waitForFinalization` resolver: `info('Finalization completed')`
- `resumeSession()`: `info('Session resuming')`
- `stopSession()`: `info('Session stopping')`

### 5. Replace `console.error` calls in `src/main/soniox-lifecycle.ts`

Import `{ debug, info, warn, error }` from `./logger`. Replace all 5 `console.error` calls:

- **Line 83** (`onAudioError`): `error('Audio capture error: %s', err.message)`
- **Line 94** (`resumeCapture` catch): `error('Failed to restart audio capture: %s', (err as Error).message)`
- **Line 111** (`connectSoniox` onConnected catch): `error('Failed to start audio capture: %s', (err as Error).message)`
- **Line 134** (`connectSoniox` onError): `error('Soniox error: %s', err.message)`
- **Line 174** (`attemptReconnect` onError): `error('Soniox error during reconnect: %s', err.message)`

Add lifecycle logging:
- `connectSoniox()`: `info('Connecting to Soniox')`
- `connectSoniox` `onConnected`: `info('Soniox connected, starting audio capture')`
- `handleDisconnect()`: `warn('Soniox disconnected (code=%d, reason=%s)', code, reason)`
- `scheduleReconnect()`: `info('Scheduling reconnect attempt %d in %dms', reconnectAttempt, delay)`
- `attemptReconnect()`: `info('Attempting reconnect')`
- `resetLifecycle()`: `debug('Lifecycle reset')`
- `finalizeSoniox()`: `debug('Finalization sent')`

### 6. Add logging to `src/main/audio.ts`

Import `{ info, debug }` from `./logger`.

- `startCapture()`: `info('Audio capture starting (device: %s)', audioInputDevice ?? 'default')`
- `startCapture()` after `stream.start()`: `debug('Audio capture started')`
- `stopCapture()`: `debug('Audio capture stopped')`

### 7. Add logging to `src/main/soniox.ts`

Import `{ info, debug }` from `./logger`.

- `connect()`: `info('Soniox WebSocket connecting to %s', SONIOX_ENDPOINT)`
- `socket.on('open')`: `debug('Soniox WebSocket connected')`
- `socket.on('close')`: `info('Soniox WebSocket closed (code=%d)', code)`
- `disconnect()`: `debug('Soniox WebSocket disconnect requested')`

### 8. Update existing tests — mock `./logger` in all affected test files

The following test files import modules that will now import `./logger`. Add `vi.mock('./logger')` to each (vitest auto-mocks all exports as no-ops):

- `src/main/session.test.ts` — imports `session.ts` → `soniox-lifecycle.ts` → `logger.ts`
- `src/main/soniox-lifecycle.test.ts` — imports `soniox-lifecycle.ts` → `logger.ts`
- `src/main/session-reconnect.test.ts` — imports `session.ts` → `soniox-lifecycle.ts` → `logger.ts`
- `src/main/audio.test.ts` — imports `audio.ts` → `logger.ts`
- `src/main/first-run.test.ts` — imports `index.ts` → `logger.ts`. Also needs `app.getPath` and `app.isPackaged` in its electron mock since `index.ts` now calls them.

For `first-run.test.ts`, update the electron mock to include:
```typescript
app: {
  whenReady: () => Promise.resolve(),
  on: vi.fn(),
  getPath: () => '/tmp/test-userData',
  isPackaged: false,
},
```

## Risks / Open Questions

1. **`app.getPath('userData')` availability**: This API is only available after `app.whenReady()`. Since `initApp()` is called inside `app.whenReady().then(...)`, this is safe.

2. **File write errors**: Handled by graceful fallback — logger operates in console-only mode if directory/file creation fails.

3. **Test isolation**: All test files that transitively import logger-using modules get `vi.mock('./logger')` to prevent file system side effects. The logger's own tests use temp directories.

4. **Performance**: WriteStream in append mode is standard for Electron apps. Log volume is very low (lifecycle events only). No concern.

5. **`soniox.test.ts`**: This test instantiates `SonioxClient` directly and mocks `ws`. Since `soniox.ts` will import from `./logger`, we need `vi.mock('./logger')` there too. (Added to step 8.)
