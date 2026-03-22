# Context

## Relevant Files

| File | Role |
|------|------|
| `src/shared/types.ts` | Empty stub (`export {};`) — will hold all shared TypeScript interfaces |
| `src/shared/ipc.ts` | Empty stub (`export {};`) — will hold IPC channel name constants |
| `spec/models.md` | Defines all data model interfaces: SonioxToken, TranscriptSegment, EditorBlock, GhostText, SessionState, AppSettings, TranscriptionRecord |
| `spec/architecture.md` | Defines IPC message table with channel names, directions, payloads |
| `tsconfig.json` | Base TS config — strict mode, ES2020 target, commonjs module |
| `tsconfig.main.json` | Main process TS config — includes `src/shared/**/*` |
| `tsconfig.renderer.json` | Renderer process TS config — includes `src/shared/**/*`, jsx: react-jsx |
| `package.json` | Project config — TypeScript 5.6, no test framework installed yet |

## Architecture

This task touches the `src/shared/` layer — pure TypeScript type definitions and constants shared between Electron's main and renderer processes. Both tsconfig files already include `src/shared/**/*`, so anything exported from this directory is importable by both processes without additional configuration.

The types come directly from `spec/models.md` and represent the core domain model: tokens from the Soniox speech-to-text API, editor state (blocks, ghost text), session lifecycle state, user settings, and transcription history records.

The IPC constants come from the `spec/architecture.md` IPC message table. They define the channel names used for Electron's `ipcMain`/`ipcRenderer` communication between main and renderer processes.

Key constraints:
- All interfaces must exactly match the field names and types in `spec/models.md`
- All IPC channel names must match the strings in `spec/architecture.md`
- Files must compile under both tsconfig.main.json (commonjs) and tsconfig.renderer.json (ES2020 module)
- No runtime dependencies — these are pure types and string constants
