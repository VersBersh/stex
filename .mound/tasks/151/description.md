# Dirty-Leaf Analysis for Re-transcription Eligibility

## Summary

Implement the renderer-side logic that inspects the live editor state at resume time and produces a `ReplayAnalysisResult` indicating whether re-transcription is eligible, and if so, the `replayStartMs`.

## Details

Node dirtiness categories:
- **Clean TimestampedTextNode**: `text === originalText` — untouched transcription
- **Dirty TimestampedTextNode**: `text !== originalText` — user edited a transcribed word
- **Plain TextNode** (no timestamp metadata): user-created content, always dirty

Re-transcription eligibility checks (applied in order):
1. **Proximity gate**: the latest dirty node must be within ~100 chars of the document end
2. **Dirty-node guard**: all nodes between the dirty node and the document end must be clean TimestampedTextNodes
3. **Paragraph-boundary guard**: the dirty node and the candidate clean tail must be in the same paragraph

`replayStartMs` determination:
- If the dirty node is a TimestampedTextNode and `currentText.endsWith(originalText)` → use the dirty node's own `startMs`
- Otherwise → use the `startMs` of the first clean node after the edit

Output shape:
```ts
interface ReplayAnalysisResult {
  eligible: boolean;
  replayStartMs: number | null;
  replayGhostStartMs: number | null;
  blockedReason: 'none' | 'paragraph-boundary' | 'dirty-tail' | 'too-far-from-end';
}
```

## Acceptance criteria

- [ ] Function/plugin inspects live editor state and returns `ReplayAnalysisResult`
- [ ] Proximity gate: edits >100 chars from doc end → `eligible: false`, `blockedReason: 'too-far-from-end'`
- [ ] Dirty-node guard: any dirty node between edit and doc end → `eligible: false`, `blockedReason: 'dirty-tail'`
- [ ] Paragraph-boundary guard: dirty node and clean tail in different paragraphs → `eligible: false`, `blockedReason: 'paragraph-boundary'`
- [ ] Correct `replayStartMs` for suffix-match vs non-suffix-match cases
- [ ] `replayGhostStartMs` identifies the start of the clean tail to be converted to ghost text
- [ ] Returns `eligible: false` with `blockedReason: 'none'` when no dirty nodes exist (no edit)
- [ ] Unit tests cover each guard and the suffix-match logic

## References

- `spec/proposal-context-refresh.md` — "Dirty-leaf model and re-transcription of poisoned context" section
- `src/` — renderer plugins, `TokenCommitPlugin.tsx`
