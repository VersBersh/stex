# Discovered Tasks

## 1. SESSION: Decompose session.ts into focused modules

**Description**: `src/main/session.ts` is 382 lines and handles session state transitions, Soniox lifecycle, audio capture, reconnect policy, clipboard behavior, overlay/window orchestration, IPC wiring, and the new onboarding guard. Extract reconnect policy and error classification into separate modules.

**Why**: Flagged by design review as a Single Responsibility violation. The file has grown organically and now has many reasons to change.

## 2. OVERLAY: Verify `window.electronAPI` preload bridge completeness

**Description**: The overlay renderer uses `window.electronAPI` for actions like `openSettings()`, `dismissError()`, `openMicSettings()`. The preload (`src/main/preload.ts`) exposes these via `contextBridge.exposeInMainWorld('electronAPI', ...)`. Verify this bridge is complete and all action buttons in the ErrorBanner work end-to-end.

**Why**: The "Open Settings" action button in the new no-api-key error depends on this bridge. During implementation, I noticed there are two separate preloads (`src/preload/index.ts` exposing `window.api` and `src/main/preload.ts` exposing `window.electronAPI`). The overlay window loads the first preload; need to verify the second one is also loaded or merged.
