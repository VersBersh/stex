# Plan: Undo/Redo Integration with Block Manager Modified Flag

## Goal

Synchronize the block manager's full state (text, structure, and `modified` flags) with Lexical undo/redo so that undoing an edit correctly reverts block ownership, preventing unnecessary block fragmentation.

## Critical Design Insight

Fixing only the `modified` flag without also restoring block text would make things **worse** — a block with `modified: false` but stale text would allow incoming tokens to extend it with mismatched content. Therefore, this implementation snapshots/restores the **full block state** (text, source, modified, id) on undo/redo.

The block manager is a separate data structure that doesn't participate in Lexical's state snapshots. When Lexical undoes an edit (restoring a previous `EditorState` with tag `'historic'`), `InlineEditPlugin` skips the update, leaving the block manager out of sync. The fix adds parallel snapshot stacks for block state, managed alongside Lexical's undo/redo stacks.

## Steps

### Step 1: Add `getSnapshot()` and `restoreSnapshot()` to `EditorBlockManager`

**File**: `src/renderer/overlay/editor/editorBlockManager.ts`

Add two methods to the manager object:

```typescript
getSnapshot(): EditorBlock[] {
  return blocks.map(b => ({ ...b }));
},

restoreSnapshot(snapshot: ReadonlyArray<Readonly<EditorBlock>>): void {
  blocks = snapshot.map(b => ({ ...b }));
},
```

`getSnapshot()` returns a deep clone of the current blocks array. `restoreSnapshot()` replaces the blocks array with a deep clone of the snapshot. Both clone to prevent aliasing between live state and stored snapshots.

**Dependencies**: None.

### Step 2: Define `BlockHistory` type and create factory

**File**: `src/renderer/overlay/editor/editorBlockManager.ts` (add at bottom, near the existing type export)

```typescript
export interface BlockHistory {
  undoStack: EditorBlock[][];
  redoStack: EditorBlock[][];
}

export function createBlockHistory(): BlockHistory {
  return { undoStack: [], redoStack: [] };
}
```

This mirrors Lexical's `HistoryState` pattern — a simple mutable object with two stacks, created via factory and shared by reference.

**Dependencies**: None.

### Step 3: Create `UndoRedoBlockSyncPlugin`

**File**: `src/renderer/overlay/editor/UndoRedoBlockSyncPlugin.tsx` (new file)

**Props**: `blockManager: EditorBlockManager`, `historyState: HistoryState`, `blockHistory: BlockHistory`

The plugin has three responsibilities:

#### 3a. Update listener — capture pre-edit snapshots

Registered via `editor.registerUpdateListener()`. Fires after HistoryPlugin (due to JSX order -> `useEffect` registration order) but before `InlineEditPlugin`.

```typescript
useEffect(() => {
  let lastSeenUndoTop: HistoryStateEntry | null = null;

  return editor.registerUpdateListener(({ editorState, prevEditorState, tags }) => {
    if (tags.has('historic')) return;

    const currentText = editorState.read(() => $getRoot().getTextContent());
    const prevText = prevEditorState.read(() => $getRoot().getTextContent());
    if (currentText === prevText) return;

    // Check if HistoryPlugin pushed a new entry (vs merge/discard)
    const undoStack = historyState.undoStack;
    const undoTop = undoStack.length > 0 ? undoStack[undoStack.length - 1] : null;

    if (undoTop !== null && undoTop !== lastSeenUndoTop) {
      // PUSH detected — snapshot pre-edit block state
      // At this point, InlineEditPlugin hasn't fired yet, so blockManager
      // still holds the pre-edit state
      blockHistory.undoStack.push(blockManager.getSnapshot());
      blockHistory.redoStack.length = 0;
    }

    lastSeenUndoTop = undoTop;
  });
}, [editor, blockManager, historyState, blockHistory]);
```

Key: This listener fires **between** HistoryPlugin and InlineEditPlugin due to JSX/useEffect registration order. At this point, the HistoryPlugin has already decided PUSH vs MERGE and updated the undo stack, but InlineEditPlugin hasn't yet called `applyEdit()`. So `blockManager.getSnapshot()` captures the pre-edit state.

For MERGE (same `undoTop`), we don't push — the existing snapshot from the original PUSH is already correct.

#### 3b. UNDO_COMMAND handler

Registered at `COMMAND_PRIORITY_LOW` (higher priority than HistoryPlugin's `COMMAND_PRIORITY_EDITOR`). Returns `false` to allow HistoryPlugin to proceed with the actual undo.

```typescript
useEffect(() => {
  return editor.registerCommand(
    UNDO_COMMAND,
    () => {
      if (blockHistory.undoStack.length > 0) {
        blockHistory.redoStack.push(blockManager.getSnapshot());
        const snapshot = blockHistory.undoStack.pop()!;
        blockManager.restoreSnapshot(snapshot);
      }
      return false; // let HistoryPlugin handle the actual undo
    },
    COMMAND_PRIORITY_LOW,
  );
}, [editor, blockManager, blockHistory]);
```

#### 3c. REDO_COMMAND handler

Same pattern, reversed stacks:

```typescript
useEffect(() => {
  return editor.registerCommand(
    REDO_COMMAND,
    () => {
      if (blockHistory.redoStack.length > 0) {
        blockHistory.undoStack.push(blockManager.getSnapshot());
        const snapshot = blockHistory.redoStack.pop()!;
        blockManager.restoreSnapshot(snapshot);
      }
      return false; // let HistoryPlugin handle the actual redo
    },
    COMMAND_PRIORITY_LOW,
  );
}, [editor, blockManager, blockHistory]);
```

**Imports needed**: `UNDO_COMMAND`, `REDO_COMMAND`, `COMMAND_PRIORITY_LOW`, `$getRoot` from `'lexical'`; `HistoryState`, `HistoryStateEntry` from `'@lexical/history'`; `useLexicalComposerContext` from `'@lexical/react/LexicalComposerContext'`; `EditorBlockManager`, `BlockHistory` from `'./editorBlockManager'`.

**Dependencies**: Steps 1, 2.

### Step 4: Wire `UndoRedoBlockSyncPlugin` into `Editor.tsx`

**File**: `src/renderer/overlay/editor/Editor.tsx`

1. Import `createBlockHistory` from `'./editorBlockManager'` and `UndoRedoBlockSyncPlugin` from `'./UndoRedoBlockSyncPlugin'`
2. Create `blockHistory` alongside existing state:
   ```typescript
   const blockHistory = useMemo(() => createBlockHistory(), []);
   ```
3. Add `UndoRedoBlockSyncPlugin` in JSX between `TokenCommitPlugin` and `InlineEditPlugin`. Add a comment documenting the ordering dependency:
   ```tsx
   <TokenCommitPlugin blockManager={blockManager} historyState={historyState} blockHistory={blockHistory} />
   {/* UndoRedoBlockSyncPlugin must be AFTER HistoryPlugin (to observe stack changes)
       and BEFORE InlineEditPlugin (to snapshot blocks before applyEdit mutates them).
       JSX order determines useEffect registration order, which determines update listener fire order. */}
   <UndoRedoBlockSyncPlugin blockManager={blockManager} historyState={historyState} blockHistory={blockHistory} />
   <InlineEditPlugin blockManager={blockManager} />
   ```

The JSX order determines `useEffect` registration order, which determines update listener fire order:
1. `HistoryPlugin` — decides PUSH/MERGE, updates undo stack
2. `UndoRedoBlockSyncPlugin` — detects PUSH, snapshots pre-edit block state
3. `InlineEditPlugin` — computes diff, calls `applyEdit()` (modifies blocks)

**Dependencies**: Steps 2, 3.

### Step 5: Clear parallel stacks alongside Lexical stacks in `TokenCommitPlugin`

**File**: `src/renderer/overlay/editor/TokenCommitPlugin.tsx`

1. Add `blockHistory: BlockHistory` to `TokenCommitPluginProps` interface
2. Add import for `BlockHistory` from `'./editorBlockManager'`
3. Clear parallel stacks in the `registerClearHook` callback:
   ```typescript
   return registerClearHook(() => {
     blockManager.clear();
     historyState.undoStack.length = 0;
     historyState.redoStack.length = 0;
     historyState.current = null;
     blockHistory.undoStack.length = 0;  // NEW
     blockHistory.redoStack.length = 0;  // NEW
   });
   ```
4. Clear parallel stacks in the `onTokensFinal` handler, alongside existing Lexical stack clearing:
   ```typescript
   historyState.undoStack.length = 0;
   historyState.redoStack.length = 0;
   historyState.current = { editor, editorState: editor.getEditorState() };
   blockHistory.undoStack.length = 0;  // NEW
   blockHistory.redoStack.length = 0;  // NEW
   ```
5. Add `blockHistory` to the `useEffect` dependency arrays that reference it.

**Dependencies**: Step 2.

### Step 6: Add snapshot/restore unit tests to block manager test file

**File**: `src/renderer/overlay/editor/editorBlockManager.test.ts`

Add a new `describe('getSnapshot / restoreSnapshot')` block:

```typescript
describe('getSnapshot / restoreSnapshot', () => {
  it('returns a deep clone of current blocks', () => {
    manager.commitFinalTokens([makeToken('Hello')]);
    const snapshot = manager.getSnapshot();

    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]).toMatchObject({ text: 'Hello', source: 'soniox', modified: false });

    // Mutating snapshot should not affect manager
    snapshot[0].text = 'Changed';
    expect(manager.getBlocks()[0].text).toBe('Hello');
  });

  it('restores blocks from a snapshot', () => {
    manager.commitFinalTokens([makeToken('Hello')]);
    const snapshot = manager.getSnapshot();

    manager.applyEdit(0, 5, 'Howdy');
    expect(manager.getBlocks()[0].modified).toBe(true);
    expect(manager.getBlocks()[0].text).toBe('Howdy');

    manager.restoreSnapshot(snapshot);
    expect(manager.getBlocks()[0].text).toBe('Hello');
    expect(manager.getBlocks()[0].modified).toBe(false);
  });

  it('restore does not alias with the provided snapshot', () => {
    manager.commitFinalTokens([makeToken('Hello')]);
    const snapshot = manager.getSnapshot();

    manager.restoreSnapshot(snapshot);
    // Mutating the original snapshot after restore should not affect manager
    snapshot[0].text = 'Changed';
    expect(manager.getBlocks()[0].text).toBe('Hello');
  });
});
```

Add a new `describe('undo/redo integration (snapshot-based)')` block testing the full flow at the block manager level:

```typescript
describe('undo/redo integration (snapshot-based)', () => {
  it('edit then undo restores modified flag to false', () => {
    manager.commitFinalTokens([makeToken('Hello world')]);
    const preEditSnapshot = manager.getSnapshot();

    manager.applyEdit(5, 1, '-'); // "Hello-world", modified: true
    expect(manager.getBlocks()[0].modified).toBe(true);

    manager.restoreSnapshot(preEditSnapshot);
    expect(manager.getBlocks()[0].modified).toBe(false);
    expect(manager.getBlocks()[0].text).toBe('Hello world');
  });

  it('edit then undo then redo re-applies modified flag', () => {
    manager.commitFinalTokens([makeToken('Hello world')]);
    const preEditSnapshot = manager.getSnapshot();

    manager.applyEdit(5, 1, '-'); // "Hello-world", modified: true
    const postEditSnapshot = manager.getSnapshot();

    // Simulate undo
    manager.restoreSnapshot(preEditSnapshot);
    expect(manager.getBlocks()[0].modified).toBe(false);

    // Simulate redo
    manager.restoreSnapshot(postEditSnapshot);
    expect(manager.getBlocks()[0].modified).toBe(true);
    expect(manager.getBlocks()[0].text).toBe('Hello-world');
  });

  it('snapshot captures multi-block state correctly', () => {
    manager.commitFinalTokens([makeToken('Hello ')]);
    manager.applyEdit(6, 0, 'world'); // tail user block
    manager.commitFinalTokens([makeToken(' end')]);

    const snapshot = manager.getSnapshot();
    expect(snapshot).toHaveLength(3);

    manager.clear();
    expect(manager.getBlocks()).toHaveLength(0);

    manager.restoreSnapshot(snapshot);
    expect(manager.getBlocks()).toHaveLength(3);
    expect(manager.getDocumentText()).toBe('Hello world end');
  });

  it('undo of cross-block edit restores removed blocks', () => {
    manager.commitFinalTokens([makeToken('Hello ')]);
    manager.applyEdit(6, 0, 'beautiful '); // user block
    manager.commitFinalTokens([makeToken('world')]);
    // blocks: [soniox: "Hello "], [user: "beautiful "], [soniox: "world"]

    const preEditSnapshot = manager.getSnapshot();
    expect(preEditSnapshot).toHaveLength(3);

    // Cross-block delete: remove "beautiful world"
    manager.applyEdit(6, 15, 'earth');
    expect(manager.getDocumentText()).toBe('Hello earth');

    manager.restoreSnapshot(preEditSnapshot);
    expect(manager.getBlocks()).toHaveLength(3);
    expect(manager.getDocumentText()).toBe('Hello beautiful world');
  });

  it('undo of tail typing removes user block', () => {
    manager.commitFinalTokens([makeToken('Hello')]);
    const preTypingSnapshot = manager.getSnapshot();

    manager.applyEdit(5, 0, ' world'); // tail insertion creates user block
    expect(manager.getBlocks()).toHaveLength(2);

    manager.restoreSnapshot(preTypingSnapshot);
    expect(manager.getBlocks()).toHaveLength(1);
    expect(manager.getDocumentText()).toBe('Hello');
  });
});
```

**Dependencies**: Step 1.

### Step 7: Add `UndoRedoBlockSyncPlugin` integration test file

**File**: `src/renderer/overlay/editor/UndoRedoBlockSyncPlugin.test.ts` (new file)

This test exercises the plugin's logic without a full Lexical/React render. It tests the **coordination logic** — the interplay between the block history stacks, the block manager, and simulated undo/redo commands. It simulates:

1. **PUSH detection**: Verify that when the simulated `historyState.undoStack` grows (new top entry), the plugin logic would push a block snapshot onto `blockHistory.undoStack`.
2. **MERGE detection**: Verify that when the simulated `historyState.undoStack` top stays the same, no additional snapshot is pushed.
3. **Undo flow**: Verify that calling the undo handler pops from `blockHistory.undoStack`, pushes current to `blockHistory.redoStack`, and calls `blockManager.restoreSnapshot()`.
4. **Redo flow**: Reverse of undo.
5. **Stack clearing**: Verify that clearing `blockHistory` stacks alongside `historyState` keeps the two aligned.
6. **Token commit invalidation**: After clearing both stacks and making new edits, verify no stale snapshots are restored.

The test structure: extract the PUSH-detection logic and undo/redo handler logic from the plugin into testable helper functions (or test the behavior by simulating the sequence of operations on `blockManager`, `historyState`, and `blockHistory` directly). This avoids needing a Lexical instance while still testing the integration semantics.

**Dependencies**: Steps 1, 2, 3.

### Step 8: Verify PUSH-vs-MERGE detection against installed Lexical

**File**: No file changes. Verification step only.

During implementation, verify the PUSH-vs-MERGE detection assumption by inspecting the installed `@lexical/history` package:

1. Check `node_modules/@lexical/history/LexicalHistory.dev.mjs` (or the compiled variant)
2. Confirm that on HISTORY_PUSH, the code does `undoStack.push({...current})` — creating a **new object**
3. Confirm that on HISTORY_MERGE, the code updates `historyState.current` but does NOT push to `undoStack` — so `undoStack[undoStack.length - 1]` retains the same object identity

This has been verified during planning against the Lexical v0.22.x source in a sibling worktree (`worker-3-7eceedcc/node_modules/@lexical/history/LexicalHistory.dev.mjs`, lines 170–264). The PUSH path does `undoStack.push({...current})` (line 251) and the MERGE path only updates `historyState.current` (line 261). The detection strategy is confirmed correct.

Add a code comment in `UndoRedoBlockSyncPlugin.tsx` noting this assumption and the Lexical version it was verified against.

**Dependencies**: Step 3.

### Step 9: Update spec files

**File**: `spec/models.md`

Extend the "Undo/Redo Scope" section (after line 63) with the Block Manager Synchronization subsection as described in `2-spec-updates.md`.

**File**: `spec/features/inline-editing.md`

Add "Undo/Redo of Edits" subsection after "Editing Committed Text" as described in `2-spec-updates.md`.

**File**: `spec/features/inline-typing.md`

Add "Undo/Redo of Typed Text" subsection after "Block Boundary Rules" as described in `2-spec-updates.md`.

**Dependencies**: None.

## Risks / Open Questions

1. **Update listener registration order**: The correctness of snapshot timing depends on `UndoRedoBlockSyncPlugin`'s update listener firing after `HistoryPlugin`'s but before `InlineEditPlugin`'s. This relies on React `useEffect` hook execution order for sibling components (which follows JSX order). This is standard React behavior but is implicit — a JSX comment documents this dependency (Step 4). A regression here would cause snapshots to capture post-edit rather than pre-edit state. If this ever proves fragile, an alternative would be to have `InlineEditPlugin` call a pre-edit hook before `applyEdit()`.

2. **HistoryPlugin MERGE detection via stack top identity**: We detect PUSH vs MERGE by comparing the identity of the top undo stack entry (`undoTop !== lastSeenUndoTop`). Verified against Lexical v0.22.x source (Step 8). This assumption should be re-verified if the Lexical dependency is upgraded.

3. **Memory**: Snapshots deep-clone the entire blocks array. Between token commits (when stacks are cleared), the number of snapshots equals the number of PUSH operations in Lexical's history. In typical use (dictation + occasional edits), this is small. Large documents with many edits before a token commit could accumulate non-trivial snapshots, but this matches Lexical's own memory profile for its undo stack.

4. **`nextBlockId` counter is NOT restored**: The block manager's `nextBlockId` is not part of the snapshot. After restore, new blocks get IDs from the current (non-restored) counter. This is correct — IDs only need to be unique, and the counter only increases, so no collisions occur.

5. **No full Lexical integration tests**: The project currently has no Lexical integration test infrastructure (no JSDOM/happy-dom setup for rendering Lexical components). Adding that would be valuable but is out of scope for this task. The unit tests (Step 6) and coordination tests (Step 7) cover the block manager and plugin logic independently. Full end-to-end verification of undo/redo in the actual editor should be done via manual testing.
