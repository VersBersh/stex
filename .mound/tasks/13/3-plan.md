# Plan — T13: Token Commit & EditorBlock Management

## Goal

Implement renderer-side logic that listens for `tokens:final` IPC events, appends finalized token text to the Lexical editor (outside undo history), and maintains an `EditorBlock[]` data structure tracking text ownership and modification state.

## Steps

### Step 1: Create `EditorBlockManager` pure logic module

**File:** `src/renderer/overlay/editor/editorBlockManager.ts` (new)

Create a pure (non-React) module that manages the `EditorBlock[]` array. This keeps block logic testable without DOM/React dependencies.

```typescript
import type { EditorBlock, SonioxToken } from '../../../shared/types';

let nextBlockId = 1;
function generateBlockId(): string {
  return `block-${nextBlockId++}`;
}

export function createEditorBlockManager() {
  let blocks: EditorBlock[] = [];

  return {
    getBlocks(): EditorBlock[] { return blocks; },

    commitFinalTokens(tokens: SonioxToken[]): void {
      const text = tokens.map(t => t.text).join('');
      if (text.length === 0) return;

      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock && lastBlock.source === 'soniox' && !lastBlock.modified) {
        lastBlock.text += text;
      } else {
        blocks.push({
          id: generateBlockId(),
          text,
          source: 'soniox',
          modified: false,
        });
      }
    },

    clear(): void {
      blocks = [];
    },

    getDocumentText(): string {
      return blocks.map(b => b.text).join('');
    },

    _resetIdCounter(): void {
      nextBlockId = 1;
    },
  };
}

export type EditorBlockManager = ReturnType<typeof createEditorBlockManager>;
```

Key decisions:
- Factory function pattern — matches the project's functional style
- Consecutive soniox tokens extend the same block per spec ownership rule #4
- Block extension check: `source === 'soniox' && !modified`
- `clear()` exposed for lifecycle reset (session start with "fresh" mode, editor clear)
- User-edit tracking (marking blocks as `modified`, creating user blocks) is **not** in scope for T13 — those are separate tasks for inline-typing/inline-editing features. The block manager will be extended by those tasks.

### Step 2: Create `TokenCommitPlugin` Lexical plugin

**File:** `src/renderer/overlay/editor/TokenCommitPlugin.tsx` (new)

A Lexical plugin component that:
1. Listens for `tokens:final` IPC events via `window.api.onTokensFinal`
2. Appends finalized text to the end of the Lexical document
3. Bypasses undo history using the `'historic'` tag + manual `historyState.current` update
4. Updates the `EditorBlockManager`

**Undo-history bypass approach (verified against Lexical 0.22 source):**

Reading `@lexical/history/LexicalHistory.dev.mjs`, the `registerHistory` function registers an update listener. The `getMergeAction` function checks tags:
- `tags.has('historic')` → returns `DISCARD_HISTORY_CANDIDATE` → the update listener returns early, `historyState.current` is NOT updated
- `tags.has('history-merge')` → returns `HISTORY_MERGE` → merges into current entry (no new undo step pushed)

Using `'historic'` tag alone has a problem: `historyState.current` is not updated to reflect the new editor state. This means the next user edit would create an undo entry pointing to a stale pre-append state, causing Ctrl+Z to also remove transcription text.

**Solution:** Use `{ discrete: true, tag: 'historic' }` for the update, then manually set `historyState.current` to the new editor state. This way:
1. The append is discarded from history (no undo entry)
2. `historyState.current` reflects the post-append state
3. Future user edits create undo entries relative to the post-append state
4. Ctrl+Z after user typing restores the post-append state (preserving transcription)

`discrete: true` makes the update synchronous, so `editor.getEditorState()` immediately after reflects the append.

```typescript
import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $createTextNode, $createParagraphNode } from 'lexical';
import type { HistoryState } from '@lexical/history';
import type { EditorBlockManager } from './editorBlockManager';
import type { SonioxToken } from '../../../shared/types';

interface TokenCommitPluginProps {
  blockManager: EditorBlockManager;
  historyState: HistoryState;
}

export function TokenCommitPlugin({ blockManager, historyState }: TokenCommitPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const unsubscribe = window.api.onTokensFinal((tokens: SonioxToken[]) => {
      const text = tokens.map(t => t.text).join('');
      if (text.length === 0) return;

      blockManager.commitFinalTokens(tokens);

      // Append to editor, bypassing undo history.
      // 'historic' tag → HistoryPlugin discards this update (DISCARD_HISTORY_CANDIDATE)
      // discrete: true → update is synchronous, so getEditorState() reflects it immediately
      editor.update(() => {
        const root = $getRoot();
        const lastChild = root.getLastChild();
        if (lastChild && lastChild.getType() === 'paragraph') {
          lastChild.append($createTextNode(text));
        } else {
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode(text));
          root.append(paragraph);
        }
      }, { discrete: true, tag: 'historic' });

      // Update historyState.current so future user edits create undo entries
      // relative to the post-append state (not the stale pre-append state)
      historyState.current = { editor, editorState: editor.getEditorState() };
    });

    return unsubscribe;
  }, [editor, blockManager, historyState]);

  return null;
}
```

### Step 3: Update `Editor.tsx` to wire plugins

**File:** `src/renderer/overlay/editor/Editor.tsx` (modify)

Changes:
1. Import `useMemo` from react
2. Import `createEmptyHistoryState` from `@lexical/history`
3. Import `TokenCommitPlugin` and `createEditorBlockManager`
4. Create shared `historyState` and `blockManager` instances (via `useMemo`)
5. Pass `externalHistoryState={historyState}` to `HistoryPlugin`
6. Add `<TokenCommitPlugin blockManager={blockManager} historyState={historyState} />`

```diff
+ import { useMemo } from 'react';
+ import { createEmptyHistoryState } from '@lexical/history';
+ import { TokenCommitPlugin } from './TokenCommitPlugin';
+ import { createEditorBlockManager } from './editorBlockManager';

  export function Editor() {
+   const historyState = useMemo(() => createEmptyHistoryState(), []);
+   const blockManager = useMemo(() => createEditorBlockManager(), []);

    return (
      <div className="editor-container">
        <LexicalComposer initialConfig={initialConfig}>
          <RichTextPlugin ... />
-         <HistoryPlugin />
+         <HistoryPlugin externalHistoryState={historyState} />
          <AutoFocusPlugin />
          <EditorBridge />
+         <TokenCommitPlugin blockManager={blockManager} historyState={historyState} />
        </LexicalComposer>
      </div>
    );
  }
```

### Step 4: Verify typing (no changes expected)

**File:** `src/shared/preload.d.ts` — already declares `onTokensFinal(callback: (tokens: SonioxToken[]) => void): () => void` on `ElectronAPI` and augments `Window.api`.

**File:** `src/preload/index.ts` — already wires the IPC listener.

No changes needed. Just verify the global type augmentation is visible to renderer code.

## Risks / Open Questions

1. **`historyState.current` manipulation**: We directly set `historyState.current` after the programmatic update. The `HistoryState` type's `current` property is public (exported type, not prefixed). This is a pragmatic approach — alternatives (forking HistoryPlugin, custom history) are significantly more complex.

2. **Block manager scope**: This task only implements soniox-token block tracking. User-edit tracking (marking blocks as `modified`, creating user blocks, block splitting on inline edits) is deferred to inline-typing and inline-editing feature tasks. The `EditorBlockManager.clear()` method is exposed but not yet wired to session lifecycle events — that wiring belongs to the session lifecycle task.

3. **Ghost text coordination**: The task description mentions ghost text removal when final tokens arrive. Since ghost text display is a separate feature, and the main process already sends `TOKENS_NONFINAL` with `[]` (empty array) on pause/stop to clear ghost text, this task does not implement ghost text clearing. The ghost text plugin (future task) will handle its own clearing when it sees new final tokens.

4. **Overlay window persistence**: The overlay window is hidden, not destroyed (`hideOverlay` in session.ts). The React tree persists across show/hide cycles. The `blockManager` created in `useMemo` will persist too. This is correct for `onShow: "append"` mode. For `onShow: "fresh"` mode, the session lifecycle task will need to call `blockManager.clear()` alongside clearing the editor. This wiring is out of scope for T13.

5. **`$createParagraphNode` availability**: Verified — this is exported from the `lexical` package.
