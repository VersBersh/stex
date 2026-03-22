# Spec Updates

## Spec changes required

### `src/shared/ipc.ts` — Add settings get/set IPC channels

The current `IpcChannels` object has `SETTINGS_UPDATED` for broadcasting changes, but lacks channels for renderers to request current settings or update individual settings. Two new channels are needed:

- `SETTINGS_GET: 'settings:get'` — renderer invokes to read current settings
- `SETTINGS_SET: 'settings:set'` — renderer invokes to update a single setting (keyed by `{ key, value }`)

These are implied by the task scope ("Renderer can read current settings", "Renderer can update individual settings") and the architecture spec ("Exposes settings to both renderers via IPC").

### `spec/architecture.md` — Add settings IPC channels to the IPC Messages table

The IPC Messages table lists `settings:updated` (Main → Renderer) but does not list the `settings:get` or `settings:set` invoke-style channels. Adding these would make the spec complete:

| Direction | Channel | Payload | Purpose |
|-----------|---------|---------|---------|
| Renderer → Main | `settings:get` | — | Request current `AppSettings` |
| Renderer → Main | `settings:set` | `{ key: keyof AppSettings, value: AppSettings[key] }` | Update a single setting |

## New spec content

No new spec files needed. The preload bridge (needed for renderers to actually invoke these channels) is a cross-cutting concern that applies to all IPC channels and should be addressed by the Window Manager task, not here.
