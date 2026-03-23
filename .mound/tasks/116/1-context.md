# Context

## Relevant Files

- `src/renderer/overlay/editor/GhostTextPlugin.tsx` — Plugin that listens for non-final Soniox tokens and renders ghost text via CSS variable; contains the scroll-follow logic that triggers prematurely.
- `src/renderer/overlay/editor/ghost-text-utils.ts` — Utility: `createGhostTextController` sets/removes the `--ghost-text-content` CSS variable on the editor root element; `escapeForCSSContent` escapes text for CSS `content` property.
- `src/renderer/overlay/editor/ghost-text.test.ts` — Unit tests for `escapeForCSSContent` and `createGhostTextController`.
- `src/renderer/overlay/editor/TokenCommitPlugin.tsx` — Plugin that handles final Soniox tokens: inserts committed text into the Lexical editor, with similar scroll-follow logic.
- `src/renderer/overlay/editor/Editor.tsx` — Root editor component, wraps Lexical with plugins including `GhostTextPlugin` and `TokenCommitPlugin`.
- `src/renderer/overlay/overlay.css` — CSS for `.editor-container` (scrollable parent, `overflow-y: auto`) and `.editor-input p:last-child::after` (renders ghost text via `--ghost-text-content` CSS variable).

## Architecture

The voice input subsystem uses Soniox speech-to-text. The main process (`soniox-lifecycle.ts`, `soniox.ts`) manages the WebSocket connection and forwards tokens to the renderer via IPC channels (`TOKENS_NONFINAL`, `TOKENS_FINAL`).

In the renderer, two Lexical plugins handle the tokens:

1. **GhostTextPlugin** — Receives non-final (speculative) tokens and displays them as ghost text using a CSS `::after` pseudo-element on the last paragraph. The text is set via a CSS variable (`--ghost-text-content`) on the editor root element, so no DOM nodes are created. After updating the ghost text, it checks if the user was "near the bottom" of the scroll container (within 50px) and, if so, scrolls to `scrollHeight`.

2. **TokenCommitPlugin** — Receives final (confirmed) tokens, inserts them into the Lexical editor as real text nodes, and similarly auto-scrolls if the user was near the bottom.

The scrollable container is `.editor-container` (`overflow-y: auto`, `flex: 1`), which wraps the `.editor-input` ContentEditable. Ghost text is rendered as a CSS pseudo-element on `.editor-input p:last-child::after`.

**Key constraint**: The `wasNearBottom` check in `GhostTextPlugin` is performed BEFORE the ghost text is rendered. When the editor has little content (no overflow), `scrollHeight == clientHeight`, making `wasNearBottom` always true. After ghost text is set, the code unconditionally scrolls to `scrollHeight`, even if the content doesn't actually overflow — causing the premature scroll described in the bug.
