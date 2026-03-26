# SPEC: Update decisions.md D4 and D5 to reflect naudiodon→getUserMedia migration

## Summary
Two decisions in `spec/decisions.md` are stale after the naudiodon→getUserMedia migration (task 142):

1. **Decision 4 (D4)** chose naudiodon over Web Audio API and included a fallback plan to switch to getUserMedia if naudiodon proved unreliable. That fallback has now been exercised — the decision should be updated to record the outcome.
2. **Decision 5 (D5)** states that audio capture uses native naudiodon in the main process. This is no longer accurate — audio capture now uses renderer-side `getUserMedia` + `AudioWorklet`.

Both decisions should be updated to reflect the current architecture.

## Acceptance criteria
- D4 is updated to note that the naudiodon fallback was exercised and getUserMedia is now the primary audio capture method
- D5 is updated to describe the current renderer-side getUserMedia + AudioWorklet architecture
- No other spec files reference naudiodon as the current audio capture method

## References
- Task 142: Replace naudiodon/PortAudio audio capture with Chromium getUserMedia
- `spec/decisions.md` — contains D4 and D5
