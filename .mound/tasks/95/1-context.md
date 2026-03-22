# Context

## Relevant Files

- `src/renderer/overlay/OverlayContext.tsx` — React context provider for overlay state; contains 3 direct `$getRoot().getTextContent()` calls (lines 64, 102, 170) that need migration
- `src/renderer/overlay/editor/lexicalTextContract.ts` — Shared helper `$getDocumentText()` established in task 86; wraps `$getRoot().getTextContent()` behind a centralized function
- `src/renderer/overlay/editor/TokenCommitPlugin.tsx` — Example consumer that uses `$getRoot` directly for DOM manipulation (not text serialization)
- `src/renderer/overlay/editor/multiParagraphIntegration.test.ts` — Integration tests for editor paragraph operations; uses `$getRoot().getTextContent()` in a local test helper (not production code)

## Architecture

The overlay subsystem provides the floating transcription editor UI. `OverlayContext.tsx` is the top-level React context that manages editor lifecycle, clipboard copy, pause/resume, and session text relay to the main process.

Task 86 established `$getDocumentText()` in `lexicalTextContract.ts` as the single centralized way to read full document text from Lexical's editor state. It wraps `$getRoot().getTextContent()` so that if the serialization strategy changes (e.g., different paragraph separator handling), only one place needs updating.

Three call sites in `OverlayContext.tsx` still use the raw `$getRoot().getTextContent()` pattern:
1. `isEditorEmpty` (line 64) — reads text to check if editor is empty
2. `copyText` (line 102) — reads text for clipboard copy
3. `onRequestSessionText` handler (line 170) — reads text to send to main process

All three are called inside `editor.getEditorState().read()` callbacks, which is exactly the context `$getDocumentText()` is designed for.
