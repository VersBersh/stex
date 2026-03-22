**Verdict** — `Approved with Notes`

**Progress**
- [x] Step 1: Update `spec/models.md` AppSettings section and add the stored-vs-effective settings subsection
- [x] Step 2: Update the Settings Store row in `spec/architecture.md` to describe `getSettings()` returning effective settings

**Issues**
1. Minor — [spec/models.md](/C:/code/draftable/stex/.mound/worktrees/worker-8-098bdc6f/spec/models.md#L116) overstates what can appear in `settings.json` by saying the on-disk file "only contains values the user explicitly configured." That is broader than the implementation guarantee. The code only guarantees that the env-derived `sonioxApiKey` is not written back; other values are persisted automatically, including window position and size on move/resize and hide in [window.ts](/C:/code/draftable/stex/.mound/worktrees/worker-8-098bdc6f/src/main/window.ts#L97), [window.ts](/C:/code/draftable/stex/.mound/worktrees/worker-8-098bdc6f/src/main/window.ts#L215). Suggested fix: narrow the sentence to the actual guarantee, e.g. "The resolved environment variable value for `sonioxApiKey` is never persisted back to `settings.json`."

Plan adherence is otherwise good: both planned doc updates were made, the wording matches `getSettings()` / `resolveSonioxApiKey()` in [settings.ts](/C:/code/draftable/stex/.mound/worktrees/worker-8-098bdc6f/src/main/settings.ts#L12), and there are no unplanned source changes or regression risks beyond that documentation overstatement.