# Struggles

## 1. Theme methods missing from new preload location
- **Category:** missing-context
- **What happened:** Task 43 moved `preload-settings.ts` to a new location but was based on a version without theme support (task 18). The new `settings-preload.ts` and `SettingsAPI` interface were missing `getResolvedTheme` and `onThemeChanged` methods that had been added on main.
- **What would have helped:** The conflict summary could note which features from main need to be integrated into the incoming changes (not just which files conflict).

## 2. Test file split on main
- **Category:** missing-context
- **What happened:** Task 44 split `window.test.ts` into multiple focused test files (`window-construction.test.ts`, `settings-window.test.ts`, etc.) after task 43 was created. The settings preload assertion needed updating in `settings-window.test.ts` (not in the conflicting file).
- **What would have helped:** The conflict summary could list files that weren't in the conflict markers but still need updating due to code restructuring on main.
