# OVERLAY: Session lifecycle block manager reset

## Summary
When the overlay is shown with `onShow: "fresh"` mode, the block manager and editor should be cleared on `session:start`. When `onShow: "append"` mode is used, both should be preserved across show/hide cycles.

The overlay window is hidden rather than destroyed, so the block manager and Lexical editor state persist across show/hide cycles. Without explicit lifecycle wiring, blocks from a previous session carry over even in "fresh" mode, which is incorrect behavior.

## Acceptance criteria
- On `session:start` with `onShow: "fresh"`, the `EditorBlockManager` is reset (all blocks cleared) and the Lexical editor content is cleared
- On `session:start` with `onShow: "append"`, the `EditorBlockManager` and Lexical editor content are preserved
- Tests cover both modes verifying block manager state after session start
- No regressions in existing session lifecycle behavior

## References
- Discovered during task T13 (Token Commit & EditorBlock Management)
- `spec/models.md` — defines `onShow` modes
- Related to T30 (Wire session lifecycle to overlay show/hide) — T30 wired session lifecycle but did not address block manager reset
