# Plan

## Goal

Expose the log file path in the settings UI so users can find and open the log directory.

## Steps

### 1. Export `getLogFilePath()` from `src/main/logger.ts`

Add a public getter function that returns the current `logFile` value (or `null` if in console-only mode):

```ts
export function getLogFilePath(): string | null {
  return logFile;
}
```

### 2. Add IPC channels to `src/shared/ipc.ts`

Add two new channel constants:

```ts
LOG_PATH_GET: 'log:get-path',
LOG_REVEAL: 'log:reveal',
```

### 3. Register IPC handlers in `src/main/settings.ts`

Inside `registerSettingsIpc()`, add:

- `ipcMain.handle(IpcChannels.LOG_PATH_GET, () => getLogFilePath())` — returns the log file path string or null.
- `ipcMain.handle(IpcChannels.LOG_REVEAL, () => { ... })` — calls `shell.showItemInFolder(logFilePath)` if the log file path is available. If the log file path is set but the file doesn't exist yet (first run, no log lines written), fall back to opening the containing directory via `shell.openPath(path.dirname(logFilePath))`.

Import `getLogFilePath` from `./logger`, `shell` from `electron`, and `path` from Node.

### 4. Extend `SettingsAPI` in `src/shared/preload.d.ts`

Add two new methods:

```ts
getLogPath(): Promise<string | null>;
revealLogFile(): Promise<void>;
```

### 5. Wire up in `src/preload/settings-preload.ts`

Add implementations:

```ts
getLogPath: () => ipcRenderer.invoke(IpcChannels.LOG_PATH_GET),
revealLogFile: () => ipcRenderer.invoke(IpcChannels.LOG_REVEAL),
```

### 6. Add UI in `src/renderer/settings/pages/General.tsx`

At the bottom of the General page (after the existing settings), add a read-only section:

```tsx
<div className="setting-group">
  <label>Log File</label>
  <div className="log-path-row">
    <code className="log-path">{logPath ?? 'Not available'}</code>
    <button type="button" className="btn" onClick={handleRevealLog} disabled={!logPath}>
      Show in folder
    </button>
  </div>
  <p className="hint">Application log file for troubleshooting.</p>
</div>
```

Add state and effect to fetch the log path on mount:

```tsx
const [logPath, setLogPath] = useState<string | null>(null);
// Fetch on mount via window.settingsApi.getLogPath()
```

The `handleRevealLog` callback calls `window.settingsApi.revealLogFile()`.

The `logPath` is fetched directly by General rather than passed through `App`, since it is not part of `AppSettings` and does not change. This avoids adding plumbing to the parent component.

### 7. Add CSS for the log path row in `src/renderer/settings/settings.css`

Add minimal styles for the `.log-path-row` and `.log-path` elements:

```css
.log-path-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.log-path {
  font-size: 12px;
  color: var(--text-muted);
  word-break: break-all;
}
```

### 8. Update `spec/architecture.md` IPC Messages table

Add two new rows to the IPC Messages table:

```
| Renderer → Main | `log:get-path` | — | Request log file path |
| Renderer → Main | `log:reveal` | — | Reveal log file/directory in OS file manager |
```

### 9. Add tests for `getLogFilePath` in `src/main/logger.test.ts`

Add tests verifying:
- `getLogFilePath()` returns `null` when `initLogger` fails (console-only mode) — test by calling `initLogger` with an invalid path
- `getLogFilePath()` returns the path to `stex.log` after successful `initLogger` call

### 10. Add tests for new IPC handlers in `src/main/settings.test.ts`

Follow the existing `registerSettingsIpc` test pattern (using `mockHandlers`):
- `registerSettingsIpc()` registers handlers for `LOG_PATH_GET` and `LOG_REVEAL` channels
- `LOG_PATH_GET` handler returns the log file path (mocking `getLogFilePath`)
- `LOG_REVEAL` handler calls `shell.showItemInFolder` (mocking shell)

Mock `./logger` module to control `getLogFilePath` return value. Add `shell` to the existing electron mock.

### 11. Add tests for the new preload methods in `src/preload/settings-preload.test.ts`

Follow existing patterns to test:
- `getLogPath` is exposed and calls `ipcRenderer.invoke` with `'log:get-path'`
- `revealLogFile` is exposed and calls `ipcRenderer.invoke` with `'log:reveal'`

## Risks / Open Questions

- **`getLogFilePath` initial state**: The logger's `logFile` starts as `null` before `initLogger()` is called. Since `initLogger()` is called early in `initApp()`, before any settings windows can open, this should never be observed in practice. The UI handles it gracefully with a "Not available" fallback.
- **Path never changes**: Once `initLogger()` runs, the path is fixed for the app lifecycle. So fetching once on mount is sufficient — no need for reactive updates.
- **File may not exist yet**: On first run, the log file may not exist until the first log line is written. The `LOG_REVEAL` handler falls back to opening the containing directory via `shell.openPath()` when `shell.showItemInFolder()` would point to a non-existent file. However, since `initLogger` is called before the settings window opens and `initApp` logs startup info, the file should exist in practice.
