# Implementation Notes for T10

## Files created or modified

| File | Change |
|------|--------|
| `src/main/soniox.ts` | Implemented SonioxClient class with connect, sendAudio, finalize, disconnect, and token parsing |
| `src/main/soniox.test.ts` | Created comprehensive test suite with 21 tests covering all acceptance criteria |
| `package.json` | Added `ws` to dependencies, `@types/ws` to devDependencies |
| `webpack.main.config.js` | Added `ws` to webpack externals |
| `package-lock.json` | Updated by `npm install` |

## Deviations from the plan

1. **`connect(settings: AppSettings)` instead of `connect()`** — Deliberate deviation for dependency inversion/testability, as documented in the plan's Risks section.

2. **Test mock structure** — Used `require('events')` inside `vi.hoisted()` instead of top-level import, because `vi.hoisted` runs before ESM imports. Used `as never` cast when passing mock events to avoid ts-loader type compatibility issues with vi.fn() mock types.

3. **JSON parse error handling** — Added try/catch around `handleMessage` JSON parsing and proper `WebSocket.Data` normalization, per code review feedback. Invalid JSON emits `onError` instead of crashing the main process.

4. **Interface Segregation (not addressed)** — Design review flagged that `connect(settings: AppSettings)` accepts the full settings object when only 4 fields are used. This is intentional — the Session Manager will pass `getSettings()` directly, and introducing a `SonioxConnectionConfig` type for 4 fields would be premature abstraction at this stage.

## New tasks or follow-up work

- The `tsconfig.main.json` includes `src/main/**/*` which causes webpack to compile test files. This works but is unnecessary — a future task could exclude `*.test.ts` from the main tsconfig.
