# Plan

## Goal

Clear ghost text (the `--ghost-text-content` CSS property) when final tokens arrive, so non-final ghost text doesn't linger after its corresponding final tokens have been committed.

## Steps

### 1. Extract ghost text controller into `ghost-text-utils.ts`

**File:** `src/renderer/overlay/editor/ghost-text-utils.ts`

Add a `createGhostTextController` function alongside the existing `escapeForCSSContent`. The controller encapsulates the ghost text CSS property management and is testable without a DOM environment.

```typescript
export interface GhostTextController {
  handleNonFinalTokens(tokens: SonioxToken[]): void;
  handleFinalTokens(): void;
}

export function createGhostTextController(
  getRoot: () => Pick<HTMLElement, 'style'> | null,
): GhostTextController {
  return {
    handleNonFinalTokens(tokens) {
      const root = getRoot();
      if (!root) return;
      const text = tokens.map(t => t.text).join('');
      if (text) {
        root.style.setProperty('--ghost-text-content', escapeForCSSContent(text));
      } else {
        root.style.removeProperty('--ghost-text-content');
      }
    },
    handleFinalTokens() {
      const root = getRoot();
      if (root) {
        root.style.removeProperty('--ghost-text-content');
      }
    },
  };
}
```

### 2. Refactor `GhostTextPlugin` to use the controller

**File:** `src/renderer/overlay/editor/GhostTextPlugin.tsx`

Replace the inline logic with the controller. Add a second `useEffect` for `onTokensFinal`.

```typescript
export function GhostTextPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const controller = createGhostTextController(() => editor.getRootElement());

    const unsubNonFinal = window.api.onTokensNonfinal((tokens) => {
      controller.handleNonFinalTokens(tokens);
    });

    const unsubFinal = window.api.onTokensFinal(() => {
      controller.handleFinalTokens();
    });

    return () => {
      unsubNonFinal();
      unsubFinal();
      const root = editor.getRootElement();
      if (root) {
        root.style.removeProperty('--ghost-text-content');
      }
    };
  }, [editor]);

  return null;
}
```

### 3. Add tests for the ghost text controller

**File:** `src/renderer/overlay/editor/ghost-text.test.ts`

Add a new `describe('createGhostTextController')` block in the existing test file. Tests use a mock style object — no DOM or React required. This keeps the file cohesive (all ghost-text utility tests together).

Test cases:
- `handleNonFinalTokens` sets `--ghost-text-content` with escaped text
- `handleNonFinalTokens` with empty tokens removes the property
- `handleFinalTokens` removes `--ghost-text-content`
- `handleFinalTokens` followed by `handleNonFinalTokens` sets new ghost text
- Both handlers are no-ops when `getRoot` returns null
- Full sequence: non-final → final → non-final (the handoff)

## Risks / Open Questions

- **Timing:** Both `GhostTextPlugin` and `TokenCommitPlugin` subscribe to `onTokensFinal`. The order of IPC listener invocation is deterministic (registration order), but both plugins are mounted simultaneously in `Editor.tsx`. Both operations (CSS property removal + Lexical `discrete` update) are synchronous in the same JS tick, so no visible flicker regardless of order.
- **Double-clear:** If `onTokensNonfinal` fires with an empty array right after `onTokensFinal`, the property gets removed twice — harmless (`removeProperty` on a non-existent property is a no-op).
- **Single effect vs two effects:** Using a single `useEffect` that subscribes to both events is simpler and ensures the controller instance is shared. Both subscriptions have the same dependency (`editor`), so a single effect is correct.
