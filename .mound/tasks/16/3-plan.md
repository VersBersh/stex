# Plan — T16: Text Output & Finalization Flow

## Goal

Implement the text output finalization flow: differentiate Escape (quick dismiss) from hotkey hide (finalize + clipboard + tray flash), wire up the renderer text response for clipboard copy, implement onShow fresh/append behavior (including history reset), and ensure manual copy works.

## Steps

### Step 1: Add `WINDOW_ESCAPE_HIDE` IPC channel

**File:** `src/shared/ipc.ts`

Add a new constant to the `IpcChannels` object:

```ts
WINDOW_ESCAPE_HIDE: 'window:escape-hide',
```

This separates the Escape key dismiss path from the finalization-aware `WINDOW_HIDE` path.

**Dependencies:** None.

### Step 2: Add `escapeHide()` to overlay electronAPI

**Files:** `src/main/preload.ts`, `src/renderer/types.d.ts`

In `src/main/preload.ts`, add to the `contextBridge.exposeInMainWorld('electronAPI', { ... })` object:

```ts
escapeHide: () => ipcRenderer.send(IpcChannels.WINDOW_ESCAPE_HIDE),
```

Requires importing `IpcChannels` (already imported).

In `src/renderer/types.d.ts`, add to the `ElectronAPI` interface:

```ts
escapeHide(): void;
```

**Note on preload architecture:** The overlay window's `webPreferences.preload` points to `dist/preload/index.js` (from `src/preload/index.ts`, which exposes `window.api`). The `src/main/preload.ts` (which exposes `window.electronAPI`) is built by `webpack.main.config.js` as a separate entry but is NOT referenced in the overlay window's `preload` option. Despite this, existing renderer code uses `window.electronAPI.hideWindow()` extensively. This dual-preload situation is a pre-existing architectural concern — follow the existing pattern by placing `escapeHide` alongside `hideWindow` in `src/main/preload.ts`. See Risk #1 for details.

**Dependencies:** Step 1.

### Step 3: Change Escape handler in renderer

**File:** `src/renderer/overlay/OverlayContext.tsx` (line 113)

Change the Escape key handler from:
```ts
window.electronAPI.hideWindow();
```
To:
```ts
window.electronAPI.escapeHide();
```

This makes Escape send `WINDOW_ESCAPE_HIDE` instead of `WINDOW_HIDE`, routing it to the quick dismiss path.

**Dependencies:** Step 2.

### Step 4: Add `requestQuickDismiss()` to session manager

**File:** `src/main/session.ts`

Add a new exported function `requestQuickDismiss()`:

```ts
export function requestQuickDismiss(): void {
  // Don't interrupt an in-progress finalization
  if (activeTransition) return;

  // Stop any active session without finalization
  if (status !== 'idle') {
    stopCapture();

    // Clear ghost text
    sendToRenderer(IpcChannels.TOKENS_NONFINAL, []);
    sendToRenderer(IpcChannels.SESSION_STOP);

    // Disconnect without waiting for finalization
    soniox?.disconnect();
    soniox = null;

    status = 'idle';
    sendStatus();
  }

  hideOverlay();
}
```

Key differences from `stopSession()`:
- **No** `soniox.finalize()` call (no empty frame sent)
- **No** `waitForFinalization()` (no async wait)
- **No** clipboard text request (`waitForClipboardText()` skipped)
- Synchronous — no `activeTransition` locking needed since there's nothing async

In `initSessionManager()`, register the IPC handler alongside the existing pause/resume handlers. Add a module-level variable to track the handler for cleanup:

```ts
let escapeHideHandler: ((...args: unknown[]) => void) | null = null;
```

In `initSessionManager()`, after the existing pause/resume cleanup/registration:

```ts
if (escapeHideHandler) {
  ipcMain.removeListener(IpcChannels.WINDOW_ESCAPE_HIDE, escapeHideHandler);
}
escapeHideHandler = () => { requestQuickDismiss(); };
ipcMain.on(IpcChannels.WINDOW_ESCAPE_HIDE, escapeHideHandler);
```

This follows the exact pattern used for `pauseHandler` and `resumeHandler` (lines 229-239).

**Dependencies:** Step 1.

### Step 5: Add `onRequestSessionText` to preload

**Files:** `src/preload/index.ts`, `src/shared/preload.d.ts`

In `src/shared/preload.d.ts`, add to `ElectronAPI`:

```ts
onRequestSessionText(callback: () => void): () => void;
```

In `src/preload/index.ts`, add to the `api` object (following the pattern of `onSessionStart` etc.):

```ts
onRequestSessionText: (callback: () => void) => {
  const handler = () => callback();
  ipcRenderer.on(IpcChannels.SESSION_TEXT, handler);
  return () => { ipcRenderer.removeListener(IpcChannels.SESSION_TEXT, handler); };
},
```

This listens for the incoming `SESSION_TEXT` from main (which is the text request). When fired, the callback reads the editor text and calls `sendSessionText(text)` to respond.

**Dependencies:** None.

### Step 6: Wire up renderer text response

**File:** `src/renderer/overlay/OverlayContext.tsx`

Add a `useEffect` in `OverlayProvider` that subscribes to the text request and responds with the editor text:

```ts
useEffect(() => {
  return window.api.onRequestSessionText(() => {
    const editor = editorRef.current;
    if (!editor) {
      window.api.sendSessionText('');
      return;
    }
    editor.getEditorState().read(() => {
      const text = $getRoot().getTextContent();
      window.api.sendSessionText(text);
    });
  });
}, []);
```

**Why `$getRoot().getTextContent()` is correct for committed text:**
By the time `waitForClipboardText()` fires the text request, `stopSession()` has already:
1. Called `soniox.finalize()` and waited for `finished: true`
2. Sent empty `TOKENS_NONFINAL` to clear ghost text
3. Sent `SESSION_STOP`

So the Lexical tree contains only committed text at this point.

**Dependencies:** Step 5.

### Step 7: Implement onShow fresh/append (with history reset)

**Files:** `src/main/session.ts`, `src/preload/index.ts`, `src/shared/preload.d.ts`, `src/renderer/overlay/OverlayContext.tsx`, `src/renderer/overlay/editor/TokenCommitPlugin.tsx`

**7a. Send `onShow` value with SESSION_START (main side)**

In `src/main/session.ts`, `startSession()` (line 86), move the `getSettings()` call (currently line 93) above the `sendToRenderer(IpcChannels.SESSION_START)` call (line 91), and change:
```ts
sendToRenderer(IpcChannels.SESSION_START);
```
To:
```ts
sendToRenderer(IpcChannels.SESSION_START, settings.onShow);
```

**7b. Update preload to pass onShow parameter**

In `src/shared/preload.d.ts`, change:
```ts
onSessionStart(callback: () => void): () => void;
```
To:
```ts
onSessionStart(callback: (onShow: 'fresh' | 'append') => void): () => void;
```

In `src/preload/index.ts`, change the `onSessionStart` implementation:
```ts
onSessionStart: (callback: (onShow: 'fresh' | 'append') => void) => {
  const handler = (_event: unknown, onShow: 'fresh' | 'append') => callback(onShow);
  ipcRenderer.on(IpcChannels.SESSION_START, handler);
  return () => { ipcRenderer.removeListener(IpcChannels.SESSION_START, handler); };
},
```

**7c. Handle onShow in renderer (clear editor)**

In `src/renderer/overlay/OverlayContext.tsx`, add a `useEffect` in `OverlayProvider`:

```ts
useEffect(() => {
  return window.api.onSessionStart((onShow) => {
    if (onShow === 'fresh') {
      clearEditor();
    }
  });
}, [clearEditor]);
```

This clears the editor synchronously when a new session starts with `onShow: 'fresh'`. When `onShow: 'append'`, the editor content is preserved.

**7d. Reset history on editor clear**

In `src/renderer/overlay/editor/TokenCommitPlugin.tsx`, add a second `registerClearHook` that resets the Lexical history state. Place it after the existing block manager clear hook (line 20):

```ts
useEffect(() => {
  return registerClearHook(() => {
    historyState.undoStack.length = 0;
    historyState.redoStack.length = 0;
    historyState.current = { editor, editorState: editor.getEditorState() };
  });
}, [registerClearHook, historyState, editor]);
```

This ensures that when the editor is cleared for fresh mode, the undo/redo stacks are also cleared. Without this, the user could press Ctrl+Z to recover the previous session's text after a fresh-mode clear.

**Note:** The clear hooks run after `$getRoot().clear()` in `clearEditor()`, so the editor state read by `editor.getEditorState()` reflects the post-clear state. The history reset uses the same pattern as `TokenCommitPlugin.tsx:53-55` (undo/redo clear after token commit).

**Dependencies:** None (independent of Steps 1-6).

### Step 8: Add tray icon flash

**File:** `src/main/tray.ts`

Add a `flashTrayIcon()` export function that briefly changes the tray icon to indicate a successful clipboard copy, then reverts:

```ts
let flashTimer: ReturnType<typeof setTimeout> | null = null;

export function flashTrayIcon(): void {
  if (!tray || tray.isDestroyed()) return;

  // Cancel any in-progress flash
  if (flashTimer) {
    clearTimeout(flashTimer);
    flashTimer = null;
  }

  const normalIcon = createTrayIcon();
  const flashIcon = createFlashIcon();

  tray.setImage(flashIcon);

  flashTimer = setTimeout(() => {
    if (tray && !tray.isDestroyed()) {
      tray.setImage(normalIcon);
    }
    flashTimer = null;
  }, 600);
}
```

For the flash icon, add a `createFlashIcon()` helper. Two approaches (implementation should choose the simplest that works):

**Option A (resource file):** Add `resources/tray-icon-success.ico` and load it:
```ts
function createFlashIcon() {
  const iconPath = path.join(app.getAppPath(), 'resources', 'tray-icon-success.ico');
  return nativeImage.createFromPath(iconPath);
}
```

**Option B (programmatic — no new asset):** Create a simple colored icon using `nativeImage`:
```ts
function createFlashIcon() {
  // Create a 16x16 green icon as a data URL
  return nativeImage.createFromDataURL(
    'data:image/png;base64,...' // pre-computed green checkmark PNG
  );
}
```

Option A is preferred for visual quality. The icon file needs to be created/added to `resources/`.

**Dependencies:** None.

### Step 9: Call tray flash after successful clipboard copy

**File:** `src/main/session.ts`

Modify `waitForClipboardText()` to return whether text was actually written:

Change return type from `Promise<void>` to `Promise<boolean>`:

```ts
function waitForClipboardText(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const handler = (_event: unknown, text: string) => {
      clearTimeout(timer);
      if (text && text.length > 0) {
        clipboard.writeText(text);
        resolve(true);
      } else {
        resolve(false);
      }
    };

    const timer = setTimeout(() => {
      ipcMain.removeListener(IpcChannels.SESSION_TEXT, handler);
      resolve(false);
    }, CLIPBOARD_TIMEOUT_MS);

    ipcMain.once(IpcChannels.SESSION_TEXT, handler);
    sendToRenderer(IpcChannels.SESSION_TEXT);
  });
}
```

In `stopSession()`, use the return value to trigger tray flash:

```ts
if (settings.onHide === 'clipboard') {
  const copied = await waitForClipboardText();
  if (copied) {
    flashTrayIcon();
  }
}
```

Import `flashTrayIcon` from `./tray`.

**Dependencies:** Step 8.

### Step 10: Add Ctrl+C "copy all when nothing selected" behavior

**File:** `src/renderer/overlay/OverlayContext.tsx`

In the existing `handleKeyDown` handler (line 110), add a case for Ctrl+C with no selection:

```ts
if (e.ctrlKey && e.key === 'c') {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    e.preventDefault();
    copyText();
  }
  // If text is selected, let default browser Ctrl+C handle it
  return;
}
```

Insert this after the Escape check (line 115) and before the Ctrl+P check (line 117).

**Dependencies:** None.

### Step 11: Update specs

**File:** `spec/architecture.md`

Apply the IPC table changes described in `2-spec-updates.md`:
- Split `session:text` entry into request and response rows
- Split `window:hide` entry and add `window:escape-hide`
- Update `session:start` payload

**File:** `spec/features/text-output.md`

Apply the manual copy wording update described in `2-spec-updates.md`:
- Update Ctrl+C description to "copies the current selection, or all text if nothing is selected"

**Dependencies:** None.

### Step 12: Add tests

**12a. Session tests** — `src/main/session.test.ts`

Add to the existing test suite:

- **`requestQuickDismiss` hides without finalization**: Start session, trigger onConnected (recording state). Call `requestQuickDismiss()`. Assert: `mockAudio.stopCapture` called, `mockSonioxInstance.finalize` NOT called, `mockHideOverlay` called, `mockSonioxInstance.disconnect` called, status sent as 'idle'.

- **`requestQuickDismiss` does not write to clipboard**: Start session, trigger onConnected. Call `requestQuickDismiss()`. Assert: `mockClipboard.writeText` NOT called, no `SESSION_TEXT` IPC sent to renderer.

- **`requestQuickDismiss` is no-op during active transition**: Start session, trigger onConnected, make visible. Call `requestToggle()` (starts stopSession, sets activeTransition). Immediately call `requestQuickDismiss()`. Assert: only one `mockHideOverlay` call (from stopSession, not from quickDismiss).

- **`stopSession` sends tray flash on successful clipboard**: Mock `flashTrayIcon` from `./tray`. Start session, make visible, requestToggle (stop). Trigger onFinished, then simulate renderer sending session text. Assert: `flashTrayIcon` called.

- **`stopSession` skips tray flash when editor is empty**: Same setup, but renderer sends empty string. Assert: `flashTrayIcon` NOT called.

- **`SESSION_START` includes onShow value**: Set `mockSettingsData.onShow = 'fresh'`. Call requestToggle (start). Assert: `webContents.send` called with `(SESSION_START, 'fresh')`.

- **`WINDOW_ESCAPE_HIDE` IPC routes to `requestQuickDismiss`**: After initSessionManager, fire the `WINDOW_ESCAPE_HIDE` handler from `mockIpcMainHandlers`. Assert the handler exists and triggers the quick dismiss path (stop capture, disconnect, hide).

**12b. Preload tests** — `src/preload/index.test.ts`

Add tests for:
- **`onRequestSessionText` listener**: Verify it registers an `ipcRenderer.on` listener for `SESSION_TEXT` channel and the returned unsubscribe function removes it.
- **`onSessionStart` with onShow parameter**: Verify the handler forwards the `onShow` parameter from the IPC event to the callback.

**12c. Tray tests** — `src/main/tray.test.ts`

Add tests for:
- **`flashTrayIcon` changes and reverts icon**: After `initTray()`, call `flashTrayIcon()`. Assert `tray.setImage` called with flash icon. Advance timers by 600ms. Assert `tray.setImage` called again with normal icon.
- **`flashTrayIcon` is safe when tray not initialized**: Call `flashTrayIcon()` before `initTray()`. Assert no error thrown.

**Dependencies:** Steps 1-11.

## Risks / Open Questions

1. **Dual preload architecture.** The overlay window's `webPreferences.preload` points to `dist/preload/index.js` (from `src/preload/index.ts`, exposing `window.api`). However, `src/main/preload.ts` (exposing `window.electronAPI`) is built by `webpack.main.config.js` as a separate entry to `dist/main/preload.js` but is NOT referenced in the overlay window's preload option. Despite this, renderer code uses `window.electronAPI.hideWindow()` extensively, and all tests pass with mocks. This suggests either (a) there's an undiscovered loading mechanism, or (b) this is a pre-existing issue that hasn't manifested because the app hasn't been tested end-to-end yet. The plan follows the existing pattern: `escapeHide()` goes in `src/main/preload.ts` alongside `hideWindow()`. If the dual-preload issue needs resolution, it should be handled as a separate task (consolidating into a single preload or adding session.setPreloads).

2. **Tray flash icon asset.** The plan calls for a `tray-icon-success.ico` file in `resources/`. If creating a proper icon is out of scope, a programmatically generated icon (green dot) can be used as a fallback. The flash duration (600ms) is a heuristic — might need adjustment for visual feel.

3. **Title bar close button behavior.** The TitleBar close button calls `window.electronAPI.hideWindow()` which routes through `requestOverlayDismiss()` → `requestToggle()` → `stopSession()` (full finalization + clipboard). This matches the hotkey behavior, which seems correct per spec. The Escape key is the only quick-dismiss path.

4. **Race between SESSION_START clear and incoming tokens.** The onShow clear happens synchronously in the renderer when it receives `SESSION_START`. Token commits happen when `TOKENS_FINAL` arrives later (after Soniox connects, user speaks, etc.). There should be no race since `SESSION_START` is sent before the Soniox connection is established. However, if `onShow: 'append'` and there's text from a previous session, new tokens should append after existing content — this works naturally since `TokenCommitPlugin` appends to the end.

5. **`requestQuickDismiss()` during `connecting` state.** If the user presses Escape while the WebSocket is still connecting (status: 'connecting'), the function disconnects the socket. This is safe — `soniox.disconnect()` handles the case where the socket isn't fully open.

6. **Ctrl+C interception and Lexical.** The Ctrl+C handler checks `window.getSelection()` to determine if text is selected. Lexical manages its own selection state, but it syncs with the DOM selection, so `window.getSelection()` should accurately reflect whether the user has selected text in the editor.

7. **History reset timing in clear hooks.** The `registerClearHook` for history reset (Step 7d) runs after `$getRoot().clear()` in `clearEditor()`. The `editor.getEditorState()` call inside the hook should return the post-clear state because `editor.update()` with the clear is called synchronously before the hooks. However, if Lexical batches the update, the history state might capture a stale snapshot. If this is observed during testing, move the history reset inside the `editor.update()` callback in `clearEditor()` instead.
