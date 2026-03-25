# Add verbose logging for editor dirty-leaves tracking

## Summary
Add development/debug logging (gated behind verbose flag) to the editor so we can observe how Lexical handles `TimestampedTextNode` during user edits. This is needed to validate assumptions about node mutation vs creation behavior before building the full context-refresh replay logic.

## Acceptance criteria
- Logging is gated behind a verbose flag (e.g. `VERBOSE_EDITOR_LOG` env var or a debug setting)
- On each non-historic editor update, log:
  - The set of `dirtyLeaves` node keys
  - For each dirty leaf: node type (`TimestampedTextNode` vs plain `TextNode`), text content, and timestamp metadata (if present)
  - Whether the dirty node was mutated (existing key) or newly created
- On token commit, log the node keys and timestamps of created `TimestampedTextNode`s
- Log output should make it clear whether typing inside/adjacent to a `TimestampedTextNode` mutates it or creates a new plain `TextNode`

## References
- Task 145 — `TimestampedTextNode` (dependency)
- `src/renderer/overlay/editor/InlineEditPlugin.tsx` — existing edit detection listener
- `src/renderer/overlay/editor/Editor.tsx` — editor setup
