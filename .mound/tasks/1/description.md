# T1: Project Scaffolding

## Summary

Set up the Electron + TypeScript + React project with build tooling and the basic file structure defined in the architecture spec.

## Scope

- Initialize `package.json` with Electron, React, TypeScript, and Lexical dependencies
- Configure TypeScript (`tsconfig.json`) for both main and renderer processes
- Set up build tooling (Webpack or Vite) with separate configs for main process (Node) and renderer process (browser/React)
- Configure `electron-builder.json` for packaging
- Create the directory structure from `spec/architecture.md`:
  - `src/main/` — main process entry and module stubs
  - `src/renderer/overlay/` — overlay window React app
  - `src/renderer/settings/` — settings window React app
  - `src/shared/` — shared types and constants
- Create minimal entry points (`src/main/index.ts`, `src/renderer/overlay/index.tsx`, `src/renderer/settings/index.tsx`) that build and launch successfully
- Verify: `npm install`, build, and `npm start` launches an empty Electron window

## Acceptance Criteria

- `npm install` succeeds with no errors
- `npm run build` compiles both main and renderer TypeScript without errors
- `npm start` launches Electron and shows an empty window
- Project structure matches `spec/architecture.md` file layout
- TypeScript strict mode enabled

## References

- `spec/architecture.md` — file structure and technology stack
- `spec/decisions.md` — Electron, React, Lexical, electron-builder choices
