# T20 Context

## Relevant Files

| File | Role |
|------|------|
| `src/main/settings.ts` | Settings Store module — currently a placeholder (`export {};`). This is the file to modify. |
| `src/shared/types.ts` | Shared types — currently a placeholder. Should define `AppSettings` interface. |
| `spec/models.md` | Spec defining `AppSettings` interface with `sonioxApiKey: string` field |
| `spec/architecture.md` | Architecture spec — defines Settings Store responsibilities (load/save preferences, API key management) |
| `.mound/tasks/3/description.md` | T3 task description — defines Settings Store defaults including `sonioxApiKey: ""` |
| `src/main/index.ts` | Electron main entry — currently uses `app.whenReady()` and `createOverlayWindow` |
| `package.json` | Project dependencies — no `electron-store` or test framework installed yet |

## Architecture

The **Settings Store** (`src/main/settings.ts`) is a main-process module responsible for:
1. Persisting `AppSettings` to disk using `electron-store` or similar
2. Providing sensible defaults for all settings fields
3. Exposing settings to renderer processes via IPC (`settings:updated` channel)

Currently, the Settings Store is not implemented — it's a placeholder `export {};`. T3 (Settings Store) defines the full implementation. T20 specifically modifies the default resolution for `sonioxApiKey`:
- T3 default: `sonioxApiKey: ""`
- T20 adds: fall back to `process.env.SONIOX_API_KEY` when no key is saved in `settings.json`

The `AppSettings.sonioxApiKey` field is consumed by:
- T10 (Soniox WebSocket Client) — needs the key to connect
- T19 (First-Run Experience) — checks if key is empty to trigger setup flow

Since T3 is not yet implemented, T20 must implement the env var fallback logic within the settings module. The scope is limited to the default/fallback mechanism — not the full Settings Store (IPC, persistence, etc.).

No test framework is configured in the project (no jest/vitest in `package.json`, no test scripts).
