# Struggles — T16: Text Output & Finalization Flow

## 1. Dual preload architecture confusion

- **Category:** missing-context
- **What happened:** The codebase has two preload scripts (`src/main/preload.ts` exposing `window.electronAPI` and `src/preload/index.ts` exposing `window.api`), but the overlay window only references one in its `webPreferences.preload`. The renderer code uses both APIs extensively. Understanding which preload is actually loaded and how `window.electronAPI` becomes available required reading webpack configs, window creation code, and build output paths. The plan review flagged this as a Critical issue.
- **What would have helped:** A note in `spec/architecture.md` or `CLAUDE.md` explaining the dual-preload pattern — which preload each window loads, how both APIs become available, and the rationale for splitting them.

## 2. Renderer text response not wired — discovery required

- **Category:** orientation
- **What happened:** The main process's `waitForClipboardText()` sends `SESSION_TEXT` to the renderer and waits for a response, but the renderer has zero code to handle this incoming request. The preload has `sendSessionText()` (renderer-to-main) but no `onRequestSessionText` listener (main-to-renderer). The same IPC channel is used bidirectionally, which made it non-obvious that half the flow was missing. Discovering this gap required reading the session manager, preload, type definitions, and renderer context in sequence.
- **What would have helped:** The task description or spec could have noted that the clipboard text request-response flow is currently stubbed on the main side but unimplemented on the renderer side. A clearer IPC channel design (separate channels for request vs response) would also have made the gap more visible.
