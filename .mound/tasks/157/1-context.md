# Context

## Relevant Files

- **README.md** — The target file. Currently contains Setup (`npm install`) and Building the installer (`npm run dist`) sections. No references to naudiodon, node-gyp, or Visual Studio C++ build tools.
- **spec/decisions.md** — Contains Decision #5 "Native Audio Capture in Main Process" which references naudiodon/PortAudio. Out of scope for this task (README only).
- **spec/models.md** — Contains `audioInputDevice` typed as "PortAudio device name". Out of scope for this task (README only).

## Architecture

The README documents setup and build instructions for stex, an Electron-based speech-to-text app. Audio capture was originally done via `naudiodon` (a native Node.js addon wrapping PortAudio), which required Visual Studio C++ build tools and `node-gyp` to compile. Task 142 replaced this with renderer-side `getUserMedia` + `AudioWorklet`, eliminating all native dependencies. Task 143 then updated the README to remove the stale naudiodon prerequisites and add installer build instructions.

## Key Finding

**This task's work is already complete.** Commit `cbfd5f9` (task 143) removed the entire "Prerequisites" section from README.md, including:
- The "Windows: C++ Build Tools" subsection with `winget install` command for Visual Studio Build Tools
- The `node-gyp rebuild` commands for naudiodon and segfault-handler
- All references to native module compilation

The current README has a simple `npm install` setup with no native dependency instructions.
