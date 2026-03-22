# T2: Shared Types & IPC Constants

## Summary

Define all shared TypeScript interfaces and IPC channel constants used across main and renderer processes.

## Scope

- Create `src/shared/types.ts` with all interfaces from `spec/models.md`:
  - `SonioxToken`
  - `TranscriptSegment`
  - `EditorBlock`
  - `GhostText`
  - `SessionState`
  - `AppSettings`
  - `TranscriptionRecord`
- Create `src/shared/ipc.ts` with IPC channel name constants from `spec/architecture.md`:
  - `session:start`, `session:stop`, `session:paused`, `session:resumed`
  - `tokens:final`, `tokens:nonfinal`
  - `session:status`, `session:text`
  - `session:request-pause`, `session:request-resume`
  - `settings:updated`

## Acceptance Criteria

- All interfaces from `spec/models.md` are defined with correct field names and types
- All IPC channels from `spec/architecture.md` are defined as typed constants
- Files compile with no TypeScript errors
- Types are importable from both main and renderer code

## References

- `spec/models.md` — all data model definitions
- `spec/architecture.md` — IPC message table
