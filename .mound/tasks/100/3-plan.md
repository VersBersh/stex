# Plan

## Goal

After transcription text updates (both final token commits and ghost text), automatically scroll the editor container to keep the latest content visible — but only when the user is already viewing the bottom of the document.

## Steps

### Step 1: Hoist `cursorAtEnd` out of the `editor.update()` callback

**File:** `src/renderer/overlay/editor/TokenCommitPlugin.tsx`

Move the `let cursorAtEnd = true;` declaration (currently at line 70, inside the `editor.update()` callback) to just before the `editor.update()` call. This makes the variable accessible after the synchronous `editor.update()` returns.

### Step 2: Add scroll-to-bottom after the final token `editor.update()` call

**File:** `src/renderer/overlay/editor/TokenCommitPlugin.tsx`

After the `editor.update()` call (after line 122), add:

```typescript
if (cursorAtEnd) {
  const rootElement = editor.getRootElement();
  if (rootElement) {
    const container = rootElement.parentElement;
    if (container) {
      const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
      if (nearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }
}
```

**Why the dual gate (`cursorAtEnd` + `nearBottom`)?**
- `cursorAtEnd` ensures we don't scroll when the user has positioned their caret mid-document to edit
- `nearBottom` ensures we don't snap-scroll the user back to the bottom if they scrolled up to read older text (their caret may still be at the end if they used the scrollbar rather than clicking)
- Threshold of 50px (~2 lines) is generous enough to handle small rounding differences

### Step 3: Add scroll-to-bottom in GhostTextPlugin for non-final tokens

**File:** `src/renderer/overlay/editor/GhostTextPlugin.tsx`

After `controller.handleNonFinalTokens(tokens)` (line 12), add scroll logic using the editor root element's parent container. Ghost text (rendered via CSS `::after`) can extend the last paragraph's height when it wraps. Only scroll if already near the bottom:

```typescript
const rootElement = editor.getRootElement();
if (rootElement) {
  const container = rootElement.parentElement;
  if (container) {
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    if (nearBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }
}
```

No `cursorAtEnd` check needed here — ghost text doesn't move the cursor and is always appended at the end. The `nearBottom` check alone prevents unwanted scrolling when the user has scrolled away.

### Summary of acceptance criteria mapping

| Criterion | How addressed |
|-----------|---------------|
| Cursor/viewport follows transcribed text | Steps 2 and 3: scroll after final commits and ghost text updates |
| User can see most recently transcribed content | Scrolls container to bottom when near bottom |
| Does not interfere with manual scroll/cursor | `cursorAtEnd` gate (Step 2) + `nearBottom` gate (Steps 2 & 3) |

## Risks / Open Questions

- **Ghost text layout**: The `::after` pseudo-element contributes to layout, so `scrollHeight` reflects its presence. This is correct — we want to scroll to show it.
- **Rapid token updates**: Multiple IPC events in quick succession each trigger scroll checks. This is fine — `scrollTop` assignment is a trivial DOM property set with no animation overhead.
- **No horizontal scroll issue**: Editor text wraps (no `white-space: nowrap`), so horizontal scrolling is not a concern.
- **Review issue 2 (from 4-plan-review.md)**: The `nearBottom` threshold of 50px is intentionally conservative. If a user scrolls up even slightly past this, auto-scroll stops. This matches expected behavior — the user has intentionally scrolled away.
