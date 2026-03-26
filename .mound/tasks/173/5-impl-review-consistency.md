**Verdict** — `Needs Fixes`

**Progress**
- [x] Step 1: Added `REPLAY_ZERO_TOKEN_TIMEOUT_MS` and `replayZeroTokenTimer`
- [x] Step 2: Started the zero-token timer in `sendReplayAudio()`
- [x] Step 3: Cancelled the zero-token timer when final tokens arrive during drain
- [x] Step 4: Cleaned up the zero-token timer in `endReplayPhase()`
- [x] Step 5: Cleaned up the zero-token timer in `resetLifecycle()`
- [x] Step 6: Updated the spec text
- [x] Step 7: Added the planned replay-drain tests

**Issues**
1. **Major** — The new fast path is only cancelled by final tokens, not by other evidence that replay is actively processing speech. In [src/main/soniox-lifecycle.ts#L438](/C:/code/draftable/stex/.mound/worktrees/worker-1-e7cef9bd/src/main/soniox-lifecycle.ts#L438) the timer is cleared only inside `onFinalTokens`, while [src/main/soniox-lifecycle.ts#L454](/C:/code/draftable/stex/.mound/worktrees/worker-1-e7cef9bd/src/main/soniox-lifecycle.ts#L454) leaves `onNonFinalTokens` unchanged. That means replay can emit non-final tokens for spoken audio, yet still be force-ended at 3 seconds and treated as “silence-only”. If that happens, `endReplayPhase()` flushes buffered live audio early and later replay finals will arrive after replay has already been declared complete. The current tests in [src/main/soniox-lifecycle.test.ts#L886](/C:/code/draftable/stex/.mound/worktrees/worker-1-e7cef9bd/src/main/soniox-lifecycle.test.ts#L886) only cover final-token arrival, so this path is untested. Suggested fix: cancel `replayZeroTokenTimer` on any replay token activity during drain, including `onNonFinalTokens`, and add a test that non-final tokens prevent the 3-second fast path from firing.