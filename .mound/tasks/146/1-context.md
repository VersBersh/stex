# Context — Task 146: Verbose logging for editor dirty-leaves tracking

## Relevant Files

| File | Role |
|------|------|
| `src/renderer/overlay/editor/InlineEditPlugin.tsx` | Existing update listener that detects user edits (non-`historic`) and computes text diffs. Serves as the pattern for registering a `registerUpdateListener`. |
| `src/renderer/overlay/editor/Editor.tsx` | Top-level editor component. Composes all plugins inside `<LexicalComposer>`. The new logging plugin will be added here. Contains `initialConfig` where `TimestampedTextNode` will be registered (by Task 145). |
| `src/renderer/overlay/editor/TokenCommitPlugin.tsx` | Handles `onTokensFinal` IPC — appends transcribed text to the editor with `historic` tag. Token commit logging will be added here. Currently creates a single `$createTextNode(text)` per final batch; Task 145 will change this to per-token `TimestampedTextNode` creation. |
| `src/renderer/overlay/editor/UserTypingPlugin.tsx` | Another update listener plugin — shows the pattern of a simple plugin that registers/unregisters a listener in `useEffect`. |
| `src/renderer/overlay/editor/lexicalTextContract.ts` | Provides `$getDocumentText()` — read-only helper for getting full editor text inside Lexical callbacks. |
| `src/shared/types.ts` | Defines `SonioxToken` (with `start_ms`, `end_ms`, `text`, etc.). |
| `src/main/logger.ts` | Main-process logger with `debug`/`info`/`warn`/`error` levels. Not directly usable from the renderer, but shows the project's logging conventions. |
| `src/preload/index.ts` | Preload bridge — exposes `window.api.log(level, message)` for renderer → main log forwarding. |
| `webpack.renderer.config.js` | Renderer webpack config. No `DefinePlugin` for env vars — renderer cannot access `process.env` directly. |
| `spec/proposal-context-refresh.md` | Parent feature proposal. Explains why timestamp metadata on nodes matters — needed for audio replay on reconnect. |

## Architecture

### Editor plugin system

The Lexical editor in this app uses a React-based plugin architecture. Each plugin is a React component rendered inside `<LexicalComposer>` in `Editor.tsx`. Plugins access the editor instance via `useLexicalComposerContext()` and register listeners in `useEffect` (returning the unsubscribe function as cleanup).

### Update listener API

Lexical's `editor.registerUpdateListener()` receives a callback with:
- `editorState` / `prevEditorState` — current and previous states
- `dirtyLeaves: Set<NodeKey>` — keys of leaf nodes that changed in this update
- `dirtyElements: Map<NodeKey, boolean>` — keys of element (container) nodes that changed
- `tags: Set<string>` — update tags (e.g., `'historic'` for programmatic commits)

The `dirtyLeaves` set is the key data for this task: it tells us which leaf nodes were touched by an update. By looking up each key in both `prevEditorState._nodeMap` and `editorState._nodeMap`, we can determine whether a node was mutated (key exists in both) or newly created (key only in current state).

### TimestampedTextNode (Task 145 — dependency)

Task 145 (currently `implementing`) introduces `TimestampedTextNode`, a `TextNode` subclass with `startMs`, `endMs`, and `originalText` metadata. Once merged, `TokenCommitPlugin` will create one `TimestampedTextNode` per Soniox token instead of a single concatenated `TextNode`. The logging added by this task is specifically designed to observe how Lexical handles these nodes during user edits (mutation vs. creation).

### Renderer environment constraints

The renderer runs in an Electron sandbox. There is no `DefinePlugin` in `webpack.renderer.config.js`, so `process.env` custom variables are not available. For a runtime-toggleable debug flag, `localStorage` is the simplest mechanism — developers can set `localStorage.setItem('VERBOSE_EDITOR_LOG', 'true')` in DevTools.

### Key constraint

The logging must be zero-cost when disabled. All log output should be gated behind a flag check at the top of each callback to avoid performance impact during normal use.
