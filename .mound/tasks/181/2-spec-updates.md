# Spec Updates

## Spec changes required

### `spec/features/realtime-transcription.md` — Silence edge case

**What**: Update the "Silence" edge case (line 38) to describe how the buffered final word is committed after the utterance ends.

**Current text**:
> **Silence**: Soniox endpoint detection fires after a pause (configurable 500ms–3000ms), finalizing the current utterance. No special handling needed.

**New text**:
> **Silence**: Soniox endpoint detection fires after a pause (configurable 500ms–3000ms), finalizing the current utterance. The token merger buffers the last word group until more tokens arrive (to handle cross-batch word continuation). After receiving final tokens, if no new final tokens arrive within a short timeout (300ms), the renderer flushes the buffered word into the editor so it appears without requiring additional speech input.

**Why**: The "no special handling needed" claim is incorrect — the token merger's buffering means the last word of an utterance stays hidden until explicitly flushed. The fix adds a timeout-based flush, which is "special handling" that should be documented.

## New spec content

None.
