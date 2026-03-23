- **Verdict** — `Needs Fixes`

- **Progress**
  - [x] Step 1. Encrypt API key at rest using `safeStorage`
  - [x] Step 2. Add masking helper and `getSettingsForRenderer()`
  - [x] Step 3. Use `getSettingsForRenderer()` in IPC handlers
  - [ ] Step 4. Update `ApiKey` component
    Status: partially done. Display/edit masking flow is implemented, but clearing an existing key no longer works.
  - [x] Step 5. Skip optimistic plaintext update in settings parent
  - [ ] Step 6. Update settings tests
    Status: partially done. Main encryption/masking coverage was added, but the UI regression above is not covered, and the plan’s explicit `maskApiKey` test was not added directly.
  - [x] Step 7. Update spec files

- **Issues**
  1. **Major** — Existing API keys can no longer be cleared. In edit mode, `Save` is disabled whenever `newValue` is empty, and the component only offers `Save`/`Cancel`, so a user with a saved key has no way to persist `''` anymore. The previous UI allowed deleting the value and saving, which is still supported by `setSetting('sonioxApiKey', '')` and is important for falling back to `SONIOX_API_KEY` or intentionally removing the key. Fix by allowing an empty save in edit mode, or add an explicit `Clear`/`Remove` action that writes `''`. [src/renderer/settings/pages/ApiKey.tsx#L16](/C:/code/draftable/stex/.mound/worktrees/worker-3-8be846f7/src/renderer/settings/pages/ApiKey.tsx#L16) [src/renderer/settings/pages/ApiKey.tsx#L65](/C:/code/draftable/stex/.mound/worktrees/worker-3-8be846f7/src/renderer/settings/pages/ApiKey.tsx#L65)

  2. **Minor** — The renderer IPC contract now carries a display-only masked key, but it is still typed everywhere as full `AppSettings`. That works with the current callers, but it weakens the domain model: `AppSettings` in main-process code means “effective usable settings”, while renderer IPC now returns a different semantic shape for `sonioxApiKey`. Fix by introducing a distinct renderer-facing type such as `RendererSettings`/`MaskedAppSettings` and using it in preload typings and IPC boundaries. [src/main/settings.ts#L70](/C:/code/draftable/stex/.mound/worktrees/worker-3-8be846f7/src/main/settings.ts#L70) [src/shared/preload.d.ts#L5](/C:/code/draftable/stex/.mound/worktrees/worker-3-8be846f7/src/shared/preload.d.ts#L5) [src/shared/preload.d.ts#L33](/C:/code/draftable/stex/.mound/worktrees/worker-3-8be846f7/src/shared/preload.d.ts#L33)

  3. **Minor** — Test coverage is close, but Step 6 is not fully matched. The plan called for a direct `maskApiKey` test, and there is no test that would catch the clearing regression in the `ApiKey` flow. Fix by adding an explicit unit test for mask formatting and a renderer-level test that verifies an existing key can be cleared/replaced without exposing plaintext state. [src/main/settings.test.ts#L369](/C:/code/draftable/stex/.mound/worktrees/worker-3-8be846f7/src/main/settings.test.ts#L369) [src/main/settings.test.ts#L389](/C:/code/draftable/stex/.mound/worktrees/worker-3-8be846f7/src/main/settings.test.ts#L389)

The main-process encryption/masking changes are otherwise coherent and the shared callers I checked still use `getSettings()` for plaintext where required. The blocking problem is the settings UI regression around clearing an existing key.