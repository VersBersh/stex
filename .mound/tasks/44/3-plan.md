# Plan

## Goal

Split `src/main/window.test.ts` into five focused test files by responsibility, each self-contained with its own mock setup (matching the existing codebase pattern).

## Steps

### Step 1: Create `src/main/window-construction.test.ts`

Self-contained test file with its own `vi.hoisted()` + `vi.mock()` blocks (same pattern as `audio.test.ts`, `hotkey.test.ts`). Move the `initWindowManager` and `getOverlayWindow` describe blocks from the original file.

Tests moved:
- Window created hidden
- Frameless, always-on-top, skip-taskbar
- Default/saved size, min size constraints
- Preload script path
- Loads overlay HTML
- Registers before-quit handler
- `getOverlayWindow` returns the window

Imports from `./window`: `initWindowManager`, `getOverlayWindow`.

### Step 2: Create `src/main/window-visibility.test.ts`

Self-contained test file. Move the `showOverlay`, `hideOverlay`, and `toggleOverlay` describe blocks.

Tests moved:
- Show makes window visible
- Show restores saved position
- Hide hides the window
- Hide saves position and size
- Hide is no-op when not visible
- Toggle shows when hidden, hides when visible

Imports from `./window`: `initWindowManager`, `showOverlay`, `hideOverlay`, `toggleOverlay`, `getOverlayWindow`.

### Step 3: Create `src/main/window-positioning.test.ts`

Self-contained test file. Move the `position validation` describe block.

Tests moved:
- Resets position when off all displays
- Uses saved position on connected display
- Centers on show when position invalid
- Validates across multiple displays

Imports from `./window`: `initWindowManager`, `showOverlay`, `getOverlayWindow`.

### Step 4: Create `src/main/window-behavior.test.ts`

Self-contained test file. Move the `opacity on focus/blur` and `close interception` describe blocks.

Tests moved:
- Opacity 1.0 on focus, 0.95 on blur
- Close converts to hide when not quitting
- Close allowed when app is quitting

Imports from `./window`: `initWindowManager`, `showOverlay`, `getOverlayWindow`.

### Step 5: Create `src/main/settings-window.test.ts`

Self-contained test file. Move the `showSettings` describe block.

Tests moved:
- Creates settings window
- Settings is framed, normal taskbar
- Settings has preload script
- Settings with normal taskbar behavior
- Constructor call count check (existing test only checks 2 constructor calls, not loadFile — preserving as-is)
- Singleton — no duplicate windows

Imports from `./window`: `initWindowManager`, `showSettings`.

### Step 6: Delete `src/main/window.test.ts`

Remove the original file after all tests have been moved.

### Step 7: Verify — run each file independently

Run each test file individually to confirm independent execution:
```bash
npx vitest run src/main/window-construction.test.ts
npx vitest run src/main/window-visibility.test.ts
npx vitest run src/main/window-positioning.test.ts
npx vitest run src/main/window-behavior.test.ts
npx vitest run src/main/settings-window.test.ts
```

Then run all together to confirm no cross-file issues:
```bash
npx vitest run src/main/window-construction.test.ts src/main/window-visibility.test.ts src/main/window-positioning.test.ts src/main/window-behavior.test.ts src/main/settings-window.test.ts
```

Verify total test count matches the original (33 tests).

## Risks / Open Questions

- **Mock duplication:** Each file duplicates the ~133-line mock setup. This is the idiomatic vitest approach matching `audio.test.ts` and `hotkey.test.ts` patterns. A future task could explore vitest's `setupFiles` to reduce duplication, but that's out of scope.
- **Module state isolation:** `window.ts` uses module-level state. Vitest isolates each test file by default, so each file gets fresh module state. `initWindowManager()` in each test resets state. No issue expected.
- **Settings window loadFile assertion:** The existing test at `showSettings > loads settings renderer HTML` only verifies constructor call count, not that `loadFile()` was called. Preserving this as-is since we're splitting, not enhancing tests.
