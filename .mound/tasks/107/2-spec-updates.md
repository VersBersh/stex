# Spec Updates

## Spec changes required

### `spec/architecture.md` — IPC Messages table

Add two new rows to the IPC Messages table:

| Direction | Channel | Payload | Purpose |
|-----------|---------|---------|---------|
| Renderer → Main | `log:get-path` | — | Request log file path |
| Renderer → Main | `log:reveal` | — | Reveal log file/directory in OS file manager |

**Why:** The IPC Messages table in architecture.md documents all IPC channels as the contract between main and renderer processes. Adding new channels without updating this table would leave it out of date.

## New spec content

None needed.
