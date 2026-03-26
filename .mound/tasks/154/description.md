# Replay Ghost Regions in TokenCommitPlugin

## Summary

Extend `TokenCommitPlugin` to support replay ghost regions — when re-transcription is eligible, convert the clean tail of the document into replay ghost text before replay begins, then re-commit Soniox's re-transcribed tokens through the normal final-token commit path.

## Details

Before replay:
1. Identify the eligible clean tail (clean `TimestampedTextNode`s from `replayGhostStartMs` to document end)
2. Remove those nodes from committed text
3. Represent them as replay ghost text (similar to live non-final ghost text)
4. If the dirty node satisfies the suffix-match case (`currentText.endsWith(originalText)`), remove the `originalText` suffix from committed text and fold it into the replay ghost region; the user-authored prefix remains committed

During replay:
- Connection B's non-final tokens render into the replay ghost region (same as live ghost text rendering)
- Connection B's final tokens re-commit into the editor as new `TimestampedTextNode`s with remapped timestamps (offset by `connectionBaseMs`), tagged `historic` to bypass undo history

After replay:
- Replay is complete when all replay audio has been sent AND Soniox has finalized the replay segment
- The replay ghost region is fully replaced by re-committed nodes

## Acceptance criteria

- [ ] Clean tail nodes are converted to replay ghost text before replay starts
- [ ] Suffix-match case: dirty node's `originalText` suffix is removed and folded into ghost region
- [ ] Non-final replay tokens render into the replay ghost region
- [ ] Final replay tokens are committed as `TimestampedTextNode`s with correct absolute timestamps
- [ ] Re-committed tokens are tagged `historic` (bypass undo history)
- [ ] Ghost text concept now supports two sources: live non-final tokens and replay-in-progress tail
- [ ] If re-transcribed text is identical to original, the round-trip still works correctly

## References

- `spec/proposal-context-refresh.md` — "Prefix/suffix matching for node replacement" and "Replay ghost conversion" sections
- `src/` — `TokenCommitPlugin.tsx`
