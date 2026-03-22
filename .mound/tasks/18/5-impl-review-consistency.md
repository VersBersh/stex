**Verdict** — `Needs Fixes`

**Progress**
- Done — Step 1: added `THEME_GET` / `THEME_RESOLVED` and `ResolvedTheme`.
- Done — Step 2: added main-process theme resolver in [theme.ts](C:/code/draftable/stex/.mound/worktrees/worker-5-d8d05577/src/main/theme.ts).
- Done — Step 3: wired theme manager into startup in [index.ts](C:/code/draftable/stex/.mound/worktrees/worker-5-d8d05577/src/main/index.ts).
- Done — Step 4: exposed theme IPC in both preload scripts.
- Done — Step 5: updated renderer type declarations.
- Partially done — Step 6: overlay CSS was converted to variables, but ghost-text theming is still not actually applied.
- Partially done — Step 7: settings CSS was converted to variables, but the planned content-surface background is not applied.
- Done — Step 8: overlay renderer initializes and listens for theme changes.
- Done — Step 9: settings renderer initializes and listens for theme changes.
- Done — Step 10: theme resolver tests were added and cover the planned main-process cases.

**Issues**
1. Major — The settings content pane never uses the planned content-surface color, so dark mode will render the main panel with the body background instead of `--bg-content`. `--bg-content` is defined in [settings.css](C:/code/draftable/stex/.mound/worktrees/worker-5-d8d05577/src/renderer/settings/settings.css#L5) and intended for the content area, but `.settings-content` in [settings.css](C:/code/draftable/stex/.mound/worktrees/worker-5-d8d05577/src/renderer/settings/settings.css#L96) only sets layout properties, while the actual content container is rendered in [index.tsx](C:/code/draftable/stex/.mound/worktrees/worker-5-d8d05577/src/renderer/settings/index.tsx#L70). That misses part of Step 7 and changes the planned light/dark surface hierarchy. Fix: add `background: var(--bg-content);` to `.settings-content` and keep the pane styling aligned with the variable table in the plan.

2. Major — Ghost-text theming is not implemented; only the variable exists. [overlay.css](C:/code/draftable/stex/.mound/worktrees/worker-5-d8d05577/src/renderer/overlay/overlay.css#L15) defines `--ghost-text-color`, but there is no selector in that file that consumes it, and the current editor tree in [Editor.tsx](C:/code/draftable/stex/.mound/worktrees/worker-5-d8d05577/src/renderer/overlay/editor/Editor.tsx#L27) contains no ghost-text-specific styling hook. That leaves the spec’s themed ghost text colors (`#999` light, `#666` dark) unapplied and makes Step 6 incomplete. Fix: style the actual ghost-text node/class/plugin with `color: var(--ghost-text-color)` and the existing italic treatment, or wire the theme variable directly into the ghost-text renderer.

3. Minor — The preload bridges widened the theme callback type to plain `string`, which weakens the new shared contract. See [preload.ts](C:/code/draftable/stex/.mound/worktrees/worker-5-d8d05577/src/main/preload.ts#L8) and [preload-settings.ts](C:/code/draftable/stex/.mound/worktrees/worker-5-d8d05577/src/main/preload-settings.ts#L21). The renderer declarations correctly use `"light" | "dark"`, so this is not a runtime bug today, but it defeats some of the value of adding `ResolvedTheme`. Fix: type these callbacks and listeners as `ResolvedTheme` (or at least `"light" | "dark"`) in the preload layer too.

No problematic unplanned changes stood out beyond a few extra tests in [theme.test.ts](C:/code/draftable/stex/.mound/worktrees/worker-5-d8d05577/src/main/theme.test.ts), which are justified.