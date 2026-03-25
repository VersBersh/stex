# Create TimestampedTextNode

## Summary
Create a custom Lexical `TextNode` subclass (`TimestampedTextNode`) that carries audio timestamp metadata from Soniox tokens. Update `TokenCommitPlugin` to emit one `TimestampedTextNode` per Soniox token instead of joining all tokens into a single plain `TextNode`.

This is groundwork for the context-refresh feature: when the user edits transcribed text, we need to know the audio timestamps of the affected tokens to determine the replay point for Soniox reconnection.

## Acceptance criteria
- `TimestampedTextNode` extends Lexical `TextNode` with:
  - `startMs: number` — audio start time of the token
  - `endMs: number` — audio end time of the token
  - `originalText: string` — the text as originally transcribed by Soniox
- Standard Lexical custom node boilerplate implemented: `getType()`, `clone()`, `createDOM()`, `updateDOM()`, `exportJSON()`, `importJSON()`
- `TimestampedTextNode` registered with the Lexical editor config in `Editor.tsx`
- `TokenCommitPlugin` creates one `TimestampedTextNode` per token from `onTokensFinal` instead of `$createTextNode(tokens.map(t => t.text).join(''))`
- Existing editor behavior (cursor tracking, scroll-follow, historic tag, undo/redo reset) is preserved
- No visual difference in the editor — `TimestampedTextNode` renders identically to `TextNode`

## References
- `src/renderer/overlay/editor/TokenCommitPlugin.tsx` — commit logic to update
- `src/renderer/overlay/editor/Editor.tsx` — editor config (node registration)
- `src/shared/types.ts` — `SonioxToken` type definition
- `spec/proposal-context-refresh.md` — parent feature proposal
