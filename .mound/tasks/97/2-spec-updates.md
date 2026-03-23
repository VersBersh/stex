# Spec Updates

## Spec changes required

### `spec/architecture.md` — IPC Messages table

**What needs to change:** Add a row for the `audio:get-devices` IPC channel to the IPC Messages table (after the `settings:set` row at ~line 132).

**New row:**
| Renderer → Main | `audio:get-devices` | — | Request list of available audio input device names |

**Why:** The channel already exists in code (`src/shared/ipc.ts`, `src/preload/settings-preload.ts`, `src/main/audio.ts`) but is not documented in the spec. Since this task completes the implementation, the spec should reflect the IPC contract.

## New spec content

None needed.
