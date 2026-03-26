# Context

## Relevant Files

- `src/renderer/overlay/editor/TimestampedTextNode.ts` — Custom Lexical node extending TextNode with `__startMs`, `__endMs`, `__originalText`. Provides `$isTimestampedTextNode` guard and `$createTimestampedTextNode` factory.
- `src/renderer/overlay/editor/TokenCommitPlugin.tsx` — Plugin that commits final Soniox tokens to the editor as TimestampedTextNodes. Uses `$getRoot`, walks paragraphs, appends nodes with `historic` tag.
- `src/renderer/overlay/editor/cursor-track-utils.ts` — Utilities for checking cursor position and moving cursor to document end. Patterns for walking root → paragraphs → text nodes.
- `src/renderer/overlay/editor/lexicalTextContract.ts` — `$getDocumentText()` and `LEXICAL_PARAGRAPH_SEPARATOR` constant.
- `src/renderer/overlay/editor/DirtyLeavesLogPlugin.tsx` — Existing plugin that inspects dirty leaves; shows patterns for distinguishing TimestampedTextNode vs plain TextNode and reading node metadata.
- `src/renderer/overlay/editor/Editor.tsx` — Lexical editor composition; registers `TimestampedTextNode` in config, composes all plugins.
- `src/shared/preload.d.ts` — `ElectronAPI` interface defining IPC channels between renderer and main process.
- `src/shared/types.ts` — Shared types including `SonioxToken`, `SessionState`, `EditorBlock`.
- `src/renderer/overlay/editor/TimestampedTextNode.test.ts` — Test patterns for Lexical nodes in jsdom environment.
- `src/renderer/overlay/editor/cursor-track.test.ts` — Test patterns for editor state assertions.
- `spec/proposal-context-refresh.md` — Spec defining the dirty-leaf model, re-transcription eligibility, and ReplayAnalysisResult shape.

## Architecture

The editor uses Lexical with a plugin-based architecture. Each plugin is a React component that returns `null` and registers Lexical listeners/commands via `useEffect`. The editor tree is Root → ParagraphNode → TextNode/TimestampedTextNode.

TimestampedTextNode extends TextNode with `startMs`, `endMs`, and `originalText` metadata. Soniox tokens produce TimestampedTextNodes (one per word). User typing produces plain TextNodes.

Node dirtiness is determined by comparing `text` to `originalText` for TimestampedTextNodes, or by the absence of timestamp metadata (plain TextNodes are always dirty).

The dirty-leaf analysis is a pure function of the current editor state (Lexical `EditorState`) — it reads all leaf nodes, classifies them, and applies three guards (proximity, dirty-tail, paragraph-boundary) to determine re-transcription eligibility.

This analysis function should be a standalone module (not a plugin) since it's called once at resume time rather than reacting to editor updates. It operates entirely within a Lexical `editorState.read()` callback.
