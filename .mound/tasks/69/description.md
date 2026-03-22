# OVERLAY: Verify window.electronAPI preload bridge completeness

## Summary

The overlay renderer uses `window.electronAPI` for actions like `openSettings()`, `dismissError()`, `openMicSettings()`. The preload (`src/main/preload.ts`) exposes these via `contextBridge.exposeInMainWorld('electronAPI', ...)`. There are two separate preloads in the codebase:

1. `src/preload/index.ts` — exposes `window.api`
2. `src/main/preload.ts` — exposes `window.electronAPI`

The overlay window loads the first preload. Need to verify the second one is also loaded or the two are merged, and that all action buttons in the ErrorBanner (e.g. "Open Settings" for no-api-key error) work end-to-end.

This was discovered during T19 implementation when adding the "Open Settings" action button for the no-api-key error banner.

## Acceptance criteria

- Audit which preload scripts are loaded by each BrowserWindow (overlay, settings)
- Verify all `window.electronAPI.*` calls in the overlay renderer are backed by the correct preload
- All ErrorBanner action buttons (openSettings, dismissError, openMicSettings) work end-to-end
- If the two preloads need merging, merge them; if they need separate loading, ensure both are configured
- Document the preload architecture decision (which window loads which preload)

## References

- `src/main/preload.ts` — exposes `window.electronAPI`
- `src/preload/index.ts` — exposes `window.api`
- Discovered during T19 (First-Run Experience) implementation
