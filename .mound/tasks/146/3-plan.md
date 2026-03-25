# Plan — Task 146: Verbose logging for editor dirty-leaves tracking

## Goal

Add development-only verbose logging (gated behind a runtime flag) to observe how Lexical handles `TimestampedTextNode` nodes during user edits — specifically whether typing inside/adjacent to a timestamped node mutates it or creates a new plain `TextNode`.

## Steps

### Step 1: Create verbose-log utility module

**File**: `src/renderer/overlay/editor/verboseEditorLog.ts` (new)

Create a small utility that:
- Exports `isVerboseEditorLog(): boolean` — checks `localStorage.getItem('VERBOSE_EDITOR_LOG') === 'true'`. Uses `localStorage` because the renderer has no access to `process.env` (no `DefinePlugin` in `webpack.renderer.config.js`).
- Exports `verboseLog(label: string, ...args: unknown[]): void` — calls `console.debug(`[VerboseEditor] [${label}]`, ...args)` only if the flag is enabled.

**Why `console.debug` and not `window.api.log`**: The project has a renderer → main log bridge (`window.api.log` in `src/preload/index.ts:8`), but this logging is intentionally DevTools-only. The dirty-leaves logging fires on every keystroke and produces high-volume structured output — sending each line across IPC to the main-process file logger would add latency and bloat the log file. `console.debug` keeps the output in the DevTools console where it can be filtered, expanded, and inspected interactively. This is a temporary diagnostic tool, not production observability.

**Pattern reference**: The project's main-process logger (`src/main/logger.ts`) uses a level-based gate. This is simpler — a single boolean toggle for renderer-side debug output.

### Step 2: Create `DirtyLeavesLogPlugin`

**File**: `src/renderer/overlay/editor/DirtyLeavesLogPlugin.tsx` (new)

Create a new Lexical plugin component following the pattern of `InlineEditPlugin.tsx` and `UserTypingPlugin.tsx`:

```tsx
interface DirtyLeavesLogPluginProps {}

export function DirtyLeavesLogPlugin({}: DirtyLeavesLogPluginProps) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return registerDirtyLeavesLogger(editor);
  }, [editor]);
  return null;
}
```

The `registerDirtyLeavesLogger(editor: LexicalEditor): () => void` function:

1. Calls `editor.registerUpdateListener(({ editorState, prevEditorState, dirtyLeaves, tags }) => { ... })`.
2. **Gate check**: First line checks `if (!isVerboseEditorLog()) return;` — zero cost when disabled.
3. **Skip historic**: `if (tags.has('historic')) return;` — only log user edits, not programmatic commits (matching the pattern in `InlineEditPlugin.tsx:17`).
4. **Log dirty leaves set**: `verboseLog('dirtyLeaves', 'keys:', [...dirtyLeaves])`.
5. **For each dirty leaf key**, read the node from **both** `prevEditorState` and `editorState` to capture the full before/after picture:

   ```ts
   for (const key of dirtyLeaves) {
     // Read previous state for this key
     let prevType: string | null = null;
     let prevText: string | null = null;
     let prevTimestampMeta: { startMs?: number; endMs?: number; originalText?: string } | null = null;

     prevEditorState.read(() => {
       const prevNode = $getNodeByKey(key);
       if (prevNode) {
         prevType = prevNode.getType();
         prevText = $isTextNode(prevNode) ? prevNode.getTextContent() : '(non-text)';
         if (prevType === 'timestamped-text') {
           prevTimestampMeta = {
             startMs: (prevNode as any).__startMs,
             endMs: (prevNode as any).__endMs,
             originalText: (prevNode as any).__originalText,
           };
         }
       }
     });

     // Read current state for this key
     editorState.read(() => {
       const node = $getNodeByKey(key);

       // Determine action
       let action: string;
       if (prevType === null && node !== null) action = 'CREATED';
       else if (prevType !== null && node === null) action = 'REMOVED';
       else if (prevType !== null && node !== null) action = 'MUTATED';
       else action = 'UNKNOWN'; // shouldn't happen

       const nodeType = node ? node.getType() : null;
       const textContent = node && $isTextNode(node) ? node.getTextContent() : null;

       const meta: Record<string, unknown> = {
         key,
         action,
         prev: prevType ? { type: prevType, text: prevText, ...( prevTimestampMeta || {}) } : null,
         curr: node ? {
           type: nodeType,
           text: textContent,
           ...(nodeType === 'timestamped-text' ? {
             startMs: (node as any).__startMs,
             endMs: (node as any).__endMs,
             originalText: (node as any).__originalText,
           } : {}),
         } : null,
       };

       verboseLog('dirtyLeaf', JSON.stringify(meta));
     });
   }
   ```

This addresses the key diagnostic cases: mutation (type/text changed but key preserved), creation (new key), removal (key in prev but not current), and type replacement (prev was `timestamped-text`, current is plain `text` — indicating Lexical replaced the custom node).

**Notes on `TimestampedTextNode` access**:
- Task 145 is a dependency that hasn't been merged yet. The logging uses `node.getType() === 'timestamped-text'` (string check) rather than importing the class, to avoid a hard dependency on Task 145's code.
- When `TimestampedTextNode` doesn't exist yet, all nodes will be `'text'` type — the logging still works and provides useful baseline data.
- The `(node as any).__startMs` access pattern follows Lexical's convention where custom node properties are stored as `__`-prefixed private fields. This will log `undefined` if the fields don't exist (pre-Task 145), which is acceptable.
- Once Task 145 merges, this can optionally be updated to import `TimestampedTextNode` and use proper type guards/getters.

**Mutation vs. creation detection**:
- Uses `$getNodeByKey(key)` via `prevEditorState.read()` and `editorState.read()` — public Lexical APIs only. The earlier plan referenced `_nodeMap` directly; this revision avoids the `@internal` field in favor of the standard read approach.

### Step 3: Add token-commit logging to `TokenCommitPlugin`

**File**: `src/renderer/overlay/editor/TokenCommitPlugin.tsx` (modify)

Inside the `window.api.onTokensFinal` callback, add logging that captures the before/after state of committed nodes.

**Import additions**: Add `import { isVerboseEditorLog, verboseLog } from './verboseEditorLog';` and `import { $isTextNode } from 'lexical';` (if not already imported) at the top.

**Before the `editor.update(...)` call**, capture the child count (only when logging is enabled):

```ts
let childCountBefore = 0;
if (isVerboseEditorLog()) {
  editor.getEditorState().read(() => {
    const root = $getRoot();
    const last = root.getLastChild();
    if ($isParagraphNode(last)) childCountBefore = last.getChildrenSize();
  });
}
```

**After the `editor.update(...)` call** (which is synchronous due to `discrete: true`), and before the history state reset:

```ts
if (isVerboseEditorLog()) {
  editor.getEditorState().read(() => {
    const root = $getRoot();
    const last = root.getLastChild();
    if ($isParagraphNode(last)) {
      const children = last.getChildren();
      const newChildren = children.slice(childCountBefore);
      verboseLog('tokenCommit', `committed ${newChildren.length} node(s):`);
      for (const child of newChildren) {
        const nodeType = child.getType();
        const isTimestamped = nodeType === 'timestamped-text';
        const meta: Record<string, unknown> = {
          key: child.getKey(),
          nodeType,
          text: child.getTextContent(),
        };
        if (isTimestamped) {
          meta.startMs = (child as any).__startMs;
          meta.endMs = (child as any).__endMs;
          meta.originalText = (child as any).__originalText;
        }
        verboseLog('tokenCommit', JSON.stringify(meta));
      }
    }
  });
}
```

This before/after approach works regardless of whether Task 145 has been merged: pre-Task 145, it logs the single `TextNode`; post-Task 145, it logs each `TimestampedTextNode`.

### Step 4: Register `DirtyLeavesLogPlugin` in `Editor.tsx`

**File**: `src/renderer/overlay/editor/Editor.tsx` (modify)

1. Add import: `import { DirtyLeavesLogPlugin } from './DirtyLeavesLogPlugin';`
2. Add `<DirtyLeavesLogPlugin />` inside `<LexicalComposer>`, after `<GhostTextPlugin />` (last position — logging should observe after all other plugins have processed):
   ```tsx
   <GhostTextPlugin />
   <DirtyLeavesLogPlugin />
   ```

The plugin takes no props and has no ordering dependencies with other plugins (it's read-only observation).

### Step 5: Manual verification

After implementation, verify the logging with the following test matrix (manually, in DevTools):

1. **Enable logging**: Run `localStorage.setItem('VERBOSE_EDITOR_LOG', 'true')` in the DevTools console, then reload the overlay.
2. **Baseline — typing in empty editor**: Type some text. Verify `dirtyLeaf` entries show `action: "CREATED"` for new `text` nodes.
3. **Token commit**: Start a recording session and let tokens commit. Verify `tokenCommit` entries log each committed node with its type and key.
4. **Typing inside committed text** (post-Task 145): Click into the middle of a committed `TimestampedTextNode` and type. Observe whether the log shows `action: "MUTATED"` on the same key (with `prev.type: "timestamped-text"` and `curr.type: "timestamped-text"`) — indicating Lexical mutated the node — or `action: "CREATED"` with `curr.type: "text"` — indicating Lexical created a new plain `TextNode`.
5. **Typing at boundary**: Position cursor at the start/end of a `TimestampedTextNode` and type. Observe whether the adjacent node is mutated or a new node is created.
6. **Backspace across boundary**: Select text spanning two `TimestampedTextNode`s and delete. Observe which nodes show as `REMOVED` vs `MUTATED`.
7. **Select-replace**: Select a `TimestampedTextNode` entirely and type replacement text. Observe node creation/removal patterns.
8. **Disable logging**: Run `localStorage.removeItem('VERBOSE_EDITOR_LOG')`. Verify no log output on subsequent edits.

Note: Steps 4–7 require Task 145 to be merged first. Steps 2–3 and 8 can be verified immediately.

## Risks / Open Questions

1. **Task 145 dependency**: `TimestampedTextNode` hasn't merged yet. The plan handles this by using string-based type checks (`getType() === 'timestamped-text'`) and `as any` casts for metadata fields. This means the logging will work both before and after Task 145, but with degraded output (all nodes show as `text` type, no timestamp metadata) until Task 145 lands. Once Task 145 merges, consider updating the logging to use proper type imports and type guards.

2. **`spec/models.md` conflict**: The current spec (`spec/models.md:59`) states the editor "uses standard `ParagraphNode` and `TextNode` types" and "avoids the complexity of custom Lexical node types." This conflicts with the `TimestampedTextNode` introduced by Task 145. However, updating `spec/models.md` is Task 145's responsibility — it introduces the custom node type. Task 146 only adds logging that observes whatever node types exist.

3. **Token commit child-count approach**: The before/after `childCountBefore` approach in Step 3 assumes all new nodes are appended to the last paragraph. This matches the current `TokenCommitPlugin` logic (and Task 145's planned changes). If a new paragraph is created (root had no paragraph), the count-before would be 0 and all children of the new paragraph are logged — correct behavior.

4. **Performance**: The logging is gated behind `isVerboseEditorLog()` which reads `localStorage` on each update. `localStorage.getItem` is synchronous but very fast (~microsecond). For a debug tool that's off by default, this is negligible. If profiling ever shows it as a hotspot, it could be cached in a module-level variable with a refresh mechanism.

5. **`timestamped-text` type string**: The plan assumes Task 145 will use `'timestamped-text'` as the Lexical node type string (the return value of `TimestampedTextNode.getType()`). This is the conventional Lexical naming pattern for custom nodes. If Task 145 uses a different string, the type check will need updating. The logging still works — it just won't branch into the timestamp metadata path.
