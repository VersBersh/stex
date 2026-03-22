# WIN: Consider removing or deprecating toggleOverlay()

## Summary
The `toggleOverlay()` function in `window.ts` calls `showOverlay()`/`hideOverlay()` directly, bypassing the Session Manager lifecycle. It is not used by any production code — the hotkey and tray both use `requestToggle()` from `session.ts`. The function is exported and tested but is a raw visibility primitive with no session awareness.

This task is to evaluate whether `toggleOverlay()` should be removed entirely, deprecated, or kept as an internal utility, and then carry out the chosen action (including updating/removing any associated tests).

## Acceptance criteria
- `toggleOverlay()` is either removed from `window.ts` (along with its tests) or clearly marked as deprecated with a rationale comment
- If removed, all references and imports of `toggleOverlay` across the codebase are cleaned up
- No production code paths are broken by the change
- Tests pass

## References
- Discovered during task T30 (Wire session lifecycle to overlay show/hide)
- `src/main/window.ts` — location of `toggleOverlay()`
- `src/main/session.ts` — `requestToggle()` is the session-aware alternative
