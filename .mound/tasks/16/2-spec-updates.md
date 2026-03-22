# Spec Updates — T16: Text Output & Finalization Flow

## Spec changes required

### 1. `spec/architecture.md` — IPC table (line 128)

**What needs to change:** The `window:hide` entry currently says "title bar button or Escape key". After T16, Escape will use a new `window:escape-hide` channel. The table needs a new entry for `window:escape-hide` and the `window:hide` description needs updating.

Also, the `session:text` entry (line 125) only shows the renderer-to-main direction. It should clarify that this channel is bidirectional (main sends empty request, renderer responds with text).

**Changes:**

Update line 125 from:
```
| Renderer → Main | `session:text` | `string` | Send final text for clipboard on hide |
```
To:
```
| Main → Renderer | `session:text` | — | Request editor text for clipboard copy |
| Renderer → Main | `session:text` | `string` | Respond with editor text for clipboard copy |
```

Update line 128 from:
```
| Renderer → Main | `window:hide` | — | Request overlay dismiss — routes through Session Manager for finalization before hiding (title bar button or Escape key) |
```
To:
```
| Renderer → Main | `window:hide` | — | Request overlay dismiss — routes through Session Manager for finalization before hiding (title bar close button) |
| Renderer → Main | `window:escape-hide` | — | Quick dismiss — stops session without finalization or clipboard, hides immediately (Escape key) |
```

**Why:** The Escape key now uses a different code path (quick dismiss) vs the title bar close button and global hotkey (full finalization). The IPC table should reflect this distinction.

### 2. `spec/architecture.md` — SESSION_START payload (line 118)

**What needs to change:** The `session:start` entry currently shows no payload (`—`). After T16, it carries the `onShow` value so the renderer knows whether to clear the editor.

Update line 118 from:
```
| Main → Renderer | `session:start` | — | Signal session started (clear editor if fresh mode) |
```
To:
```
| Main → Renderer | `session:start` | `onShow: 'fresh' \| 'append'` | Signal session started. Renderer clears editor if onShow is 'fresh'. |
```

**Why:** The renderer needs the `onShow` value synchronously to decide whether to clear before tokens arrive. Sending it with SESSION_START avoids an async settings fetch race.

### 3. `spec/features/text-output.md` — Manual Copy section (line 23)

**What needs to change:** The manual copy section currently says "Standard `Ctrl+C` works for copying selected text". The hotkeys spec (`spec/hotkeys.md` line 21) defines Ctrl+C as "Copy selected text (or all text if nothing selected)". The text-output spec should match.

Update line 23-24 from:
```
- Standard `Ctrl+C` works for copying selected text
- `Ctrl+A` selects all text in the editor (committed + any finalized ghost text)
```
To:
```
- `Ctrl+C` copies the current selection, or all text if nothing is selected
- `Ctrl+A` selects all text in the editor (committed + any finalized ghost text)
```

**Why:** Consistency with the hotkeys spec, which defines the "copy all when nothing selected" behavior that Step 10 of the plan implements.

## New spec content

No new spec files are needed. The existing specs (`text-output.md`, `hotkeys.md`, `system-tray.md`) already describe the desired behavior. The changes above keep the architecture and feature specs consistent with the implementation.
