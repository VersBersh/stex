# Implementation Notes

## Files modified
- `src/main/logger.ts` — Added `getLogFilePath()` export that returns the current log file path or null
- `src/shared/ipc.ts` — Added `LOG_PATH_GET` and `LOG_REVEAL` channel constants
- `src/main/settings.ts` — Added IPC handlers for log path retrieval and reveal; imported `fs`, `path`, `shell` from electron, and `getLogFilePath` from logger. Reveal handler checks file existence and falls back to opening the directory.
- `src/shared/preload.d.ts` — Added `getLogPath()` and `revealLogFile()` to `SettingsAPI` interface
- `src/preload/settings-preload.ts` — Wired up `getLogPath` and `revealLogFile` via `ipcRenderer.invoke`
- `src/renderer/settings/pages/General.tsx` — Added log file path display with "Show in folder" button at bottom of General settings
- `src/renderer/settings/settings.css` — Added `.log-path-row` and `.log-path` styles
- `spec/architecture.md` — Added `log:get-path` and `log:reveal` to IPC Messages table
- `src/main/logger.test.ts` — Added `getLogFilePath` tests
- `src/main/settings.test.ts` — Added tests for `LOG_PATH_GET` and `LOG_REVEAL` IPC handlers with logger, shell, and fs mocks. Covers file-exists, file-not-exists, and null-path branches.
- `src/preload/settings-preload.test.ts` — Added tests for `getLogPath` and `revealLogFile` bridge methods

## Deviations from plan
- None — implementation matches the revised plan including the file-existence fallback.

## New tasks or follow-up work
None discovered.
