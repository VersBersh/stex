# Context

## Relevant Files

| File | Role |
|------|------|
| `spec/models.md` | Defines data models including `AppSettings` — currently describes it as "Persisted user preferences" without distinguishing stored vs effective values |
| `spec/architecture.md` | Describes system architecture including the Settings Store component (line 73) — does not mention the env var resolution rule |
| `src/main/settings.ts` | Implementation of Settings Store — contains `resolveSonioxApiKey()` and `getSettings()` which returns effective (resolved) settings |
| `.mound/tasks/23/6-discovered-tasks.md` | Origin of this task — item #1 flagged the spec/implementation gap |

## Architecture

The **Settings Store** (`src/main/settings.ts`) manages user preferences persisted in `settings.json` via `electron-store`. It exposes two key functions:

- `getSettings()` — returns an `AppSettings` object with all fields populated. For `sonioxApiKey`, it calls `resolveSonioxApiKey(savedValue)` which applies precedence: saved value > `SONIOX_API_KEY` env var > empty string. The resolved value is returned at runtime but **never written back** to the store.
- `setSetting(key, value)` — writes directly to the underlying `electron-store`.

The spec currently describes `AppSettings` as purely persisted, but the implementation returns an "effective" view where some fields (currently only `sonioxApiKey`) may differ from what is stored on disk. This task closes that documentation gap.
