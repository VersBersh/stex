# Context

## Relevant Files

| File | Role |
|------|------|
| `src/main/window.ts` | Window Manager — contains `toggleOverlay()` (line 248), plus `showOverlay()`, `hideOverlay()`, and other window management exports |
| `src/main/session.ts` | Session Manager — contains `requestToggle()` (line 198), the session-aware alternative that handles start/stop lifecycle |
| `src/main/hotkey.ts` | Hotkey Manager — imports `requestToggle` from `./session` (NOT `toggleOverlay`) |
| `src/main/tray.ts` | Tray Manager — imports `requestToggle` from `./session` (NOT `toggleOverlay`) |
| `src/main/index.ts` | App entry point — does not import `toggleOverlay` |
| `src/main/window-visibility.test.ts` | Tests for showOverlay, hideOverlay, and toggleOverlay — imports `toggleOverlay` from `./window` |

## Architecture

The overlay window lifecycle has two layers:

1. **Window Manager** (`window.ts`) — low-level primitives: `showOverlay()`, `hideOverlay()`, `toggleOverlay()`. These directly manipulate BrowserWindow visibility with no session awareness.

2. **Session Manager** (`session.ts`) — high-level lifecycle: `requestToggle()`. This coordinates showing/hiding the overlay with audio capture start/stop, Soniox connection, finalization, and clipboard copy. Both the hotkey and tray call `requestToggle()`.

`toggleOverlay()` is a leftover from the initial Window Manager implementation (task T4), before the Session Manager existed. After T30 wired session lifecycle to overlay show/hide, `toggleOverlay()` became dead code — no production module imports it. Only the test file `window-visibility.test.ts` references it.
