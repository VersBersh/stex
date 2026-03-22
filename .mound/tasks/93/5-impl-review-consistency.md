**Verdict** — `Needs Fixes`

**Progress**
- [x] Step 1: update default Vitest config to keep integration tests out of `npm test` — done
- [x] Step 2: add `test:integration` script to `package.json` — done
- [x] Step 3: create a separate integration Vitest config with a longer timeout — done
- [ ] Step 4: add the live Soniox integration test — partially done
- [x] Step 5: rely on existing logger fallback behavior — done

**Issues**
1. **Major** — The integration test can pass without ever observing the `finished` callback, which is the core behavior the plan asked it to verify. In [src/main/soniox.integration.test.ts](C:/code/draftable/stex/.mound/worktrees/worker-2-443b35f2/src/main/soniox.integration.test.ts#L62), `donePromise` resolves on a normal close (`code === 1000`) as well as on `onFinished`. That means a regression in [src/main/soniox.ts](C:/code/draftable/stex/.mound/worktrees/worker-2-443b35f2/src/main/soniox.ts#L122) could be masked if the socket closes cleanly before `finished: true` is parsed. Suggested fix: only treat `onFinished` as success, or at minimum track a `finishedReceived` flag and assert it after the socket closes.

2. **Major** — The Vitest exclusion change is likely to drop Vitest’s default excludes rather than extend them. [vitest.config.ts](C:/code/draftable/stex/.mound/worktrees/worker-2-443b35f2/vitest.config.ts#L1) now sets `exclude` to only `['**/*.integration.test.ts']`. That is a regression risk because default excludes like `node_modules`, `dist`, coverage outputs, and config temp directories may stop being ignored. Suggested fix: import `configDefaults` from `vitest/config` and use `exclude: [...configDefaults.exclude, '**/*.integration.test.ts']`.

3. **Minor** — The main integration test does not implement all of the explicit assertions from the plan, so step 4 is only partially complete. In [src/main/soniox.integration.test.ts](C:/code/draftable/stex/.mound/worktrees/worker-2-443b35f2/src/main/soniox.integration.test.ts#L49), it waits for connection and completion, but it never asserts the expected success conditions directly (`connected was established`, `audio was sent`, `finished was received`). Suggested fix: keep explicit booleans/counters for those checkpoints and assert them at the end so failures are diagnostic and plan-complete.