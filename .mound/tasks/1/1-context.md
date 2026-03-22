# Context

## Relevant Files

| File | Role |
|------|------|
| `spec/architecture.md` | Defines file structure, component responsibilities, IPC messages, and technology stack |
| `spec/decisions.md` | Documents technology choices: Electron, React, Lexical, naudiodon, Soniox, electron-builder |
| `README.md` | Project overview — live speech-to-text with inline editing, system tray app |

## Architecture

This is a **greenfield project** — no source code, `package.json`, or build configuration exists yet.

**stex** is an Electron desktop app with:
- **Main process** (`src/main/`): system tray, window management, hotkeys, audio capture, Soniox WebSocket client, session orchestration
- **Overlay renderer** (`src/renderer/overlay/`): React + Lexical editor for real-time transcription display and inline editing
- **Settings renderer** (`src/renderer/settings/`): React settings UI (API key, hotkeys, preferences)
- **Shared code** (`src/shared/`): TypeScript types and IPC channel constants shared between main and renderer processes

Key constraints:
- TypeScript throughout with strict mode
- Two separate renderer processes (overlay and settings), each with their own HTML entry point and React root
- Build tooling must handle both Node.js (main process) and browser (renderer) targets
- Packaging via `electron-builder`
- Dependencies include: Electron, React, TypeScript, Lexical (and later naudiodon, but not for this task)
