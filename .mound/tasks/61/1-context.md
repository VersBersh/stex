# Context

## Relevant Files

- `src/renderer/overlay/editor/GhostTextPlugin.tsx` — Listens to `onTokensNonfinal`, sets `--ghost-text-content` CSS custom property on editor root to display non-final tokens as ghost text via a `::after` pseudo-element.
- `src/renderer/overlay/editor/TokenCommitPlugin.tsx` — Listens to `onTokensFinal`, appends finalized text to the Lexical editor as TextNodes and tracks via `EditorBlockManager`.
- `src/renderer/overlay/editor/Editor.tsx` — Composes both plugins within a `LexicalComposer`.
- `src/renderer/overlay/overlay.css` — Contains `.editor-input p:last-child::after` rule that renders `--ghost-text-content` as italic gray text.
- `src/renderer/overlay/editor/ghost-text-utils.ts` — `escapeForCSSContent()` helper for CSS content property escaping.
- `src/renderer/overlay/editor/ghost-text.test.ts` — Tests for `escapeForCSSContent`.
- `src/shared/preload.d.ts` — `ElectronAPI` type with `onTokensFinal` and `onTokensNonfinal` callback signatures.
- `src/preload/index.ts` — IPC bridge exposing `onTokensFinal`/`onTokensNonfinal` to renderer.
- `spec/models.md` — Defines `GhostText` model and token lifecycle (non-final → final).

## Architecture

The ghost text system uses a CSS-only approach: `GhostTextPlugin` sets a CSS custom property `--ghost-text-content` on the editor root, and a `::after` pseudo-element on the last paragraph displays it. This avoids inserting/removing Lexical nodes for ephemeral non-final text.

`TokenCommitPlugin` independently listens for final tokens and appends them as real Lexical `TextNode`s in the document.

The two plugins share no state and have no coordination. Ghost text is only cleared when:
1. A new `onTokensNonfinal` event arrives with an empty token list
2. The `GhostTextPlugin` component unmounts

The gap: when final tokens arrive (step 2 of the token lifecycle), `GhostTextPlugin` does not clear the CSS property. The ghost text from the preceding non-final tokens persists until the next `onTokensNonfinal` event, which may cause a brief period of duplicate text (committed text + lingering ghost text).
