# T50: Implementation Notes

## Files modified

- `src/main/window.ts` — added `import { resolveTheme } from './theme'`, added `backgroundColor` to both overlay and settings window constructor options based on resolved theme
- `src/main/window-construction.test.ts` — added `mockResolvedTheme` to hoisted mocks, added `vi.mock('./theme')`, added 2 backgroundColor tests for overlay window
- `src/main/settings-window.test.ts` — added `mockResolvedTheme` to hoisted mocks, added `vi.mock('./theme')`, added 2 backgroundColor tests for settings window
- `src/main/window-behavior.test.ts` — added `vi.mock('./theme')` (required since `window.ts` now imports `./theme`)
- `src/main/window-positioning.test.ts` — added `vi.mock('./theme')` (same reason)
- `src/main/window-visibility.test.ts` — added `vi.mock('./theme')` (same reason)

## Deviations from plan

- **Additional test files needed mocking**: The plan only mentioned adding tests to `window-construction.test.ts` and `settings-window.test.ts`, but three other test files (`window-behavior`, `window-positioning`, `window-visibility`) also import `window.ts` and needed a `vi.mock('./theme')` to avoid import failures from the new `resolveTheme` dependency.

## New tasks or follow-up work

None discovered.
