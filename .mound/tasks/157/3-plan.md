# Plan

## Goal

Remove naudiodon/node-gyp build instructions from README.md so new contributors aren't confused by stale prerequisites.

## Finding: No Changes Needed

The work described in this task has already been completed by task 143 (commit `cbfd5f9`). That commit:

1. Removed the entire "Prerequisites" section containing:
   - "Windows: C++ Build Tools" heading and `winget install` command for Visual Studio 2022 Build Tools with VCTools workload
   - "Setup" subsection with `node-gyp rebuild` commands for naudiodon and segfault-handler native modules
2. Replaced it with a simple "Setup" section containing only `npm install`
3. Added a "Building the installer" section documenting `npm run dist`

### Verification

- `README.md` currently contains zero matches for: `naudiodon`, `node-gyp`, `Visual Studio`, `PortAudio`, `VCTools`, `C++ Build Tools`, `native`, `rebuild`
- The Setup section accurately reflects the current getUserMedia-based architecture (no native dependencies)
- Build steps (`npm install` then `npm run dist`) work with the current codebase

## Steps

No implementation steps required. All acceptance criteria are already satisfied:

1. **All references to naudiodon, node-gyp, and Visual Studio C++ build tools are removed from README.md** — Confirmed: zero matches in current README.
2. **Audio-related setup instructions accurately reflect the current getUserMedia-based architecture** — Confirmed: Setup is just `npm install` with no native dependency instructions.
3. **README build steps still work end-to-end after changes** — No changes to make; current README is correct.

## Risks / Open Questions

- **Task may be a duplicate / already-done**: This task was likely created before task 143 was completed. Task 143's commit message explicitly states "Update README to remove outdated naudiodon prerequisites." The task should be marked as complete with no code changes.
- **Stale spec references**: `spec/decisions.md` Decision #5 and `spec/models.md` still reference naudiodon/PortAudio. These are outside this task's README scope but should be addressed in a separate task.
