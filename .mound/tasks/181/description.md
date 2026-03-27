# Fix: last spoken word buffered until next speech input

## Summary

There is a bug in the speech transcription pipeline where the final word of a spoken phrase is not displayed in the editor until the user speaks the next word. This creates a frustrating delay where the last word appears "stuck" in a buffer.

**Reproduction steps:**
1. Speak: "hello this is a transcription"
2. Pause — editor shows: "hello this is a"
3. Wait — the word "transcription" does not appear
4. Speak: "and I"
5. Pause — editor now shows: "hello this is a transcription and"

The pattern is that the most recent word is always held back until new speech input arrives.

## Likely cause

The feedback author suspects this is related to the code that groups tokens into words. The word-grouping logic may be waiting for the next token before flushing the current word, causing the last word to remain in an internal buffer until new input arrives.

## Acceptance criteria

- When the user pauses speaking, all recognized words — including the final word — appear in the editor without requiring additional speech input.
- The fix should not introduce duplicate words or other regressions in the transcription display.
- Existing tests pass; add a test covering the "final word after pause" scenario if feasible.

## References

- Feedback: `.mound/feedback/20260327-150221-007-8fa0.md`
- Investigate the token-to-word grouping/buffering logic in the transcription pipeline
