# Plan

## Goal

Fix premature scrolling in the input box when the first ghost text arrives from Soniox by only scrolling when content actually overflows the visible area.

## Steps

### Step 1: Fix scroll-follow logic in GhostTextPlugin.tsx

**File**: `src/renderer/overlay/editor/GhostTextPlugin.tsx`

**Current logic** (lines 11–31):
1. Capture `wasNearBottom` BEFORE ghost text mutation
2. Set ghost text via `controller.handleNonFinalTokens(tokens)`
3. If `wasNearBottom`, scroll to `scrollHeight`

**Problem**: When the editor has little/no overflow, `scrollHeight - scrollTop - clientHeight` is 0, so `wasNearBottom` is always `true`. After ghost text is set, the code scrolls to bottom even if content doesn't actually overflow.

**Fix**: Keep the `wasNearBottom` guard but add an overflow check AFTER the ghost text is rendered:

```typescript
const unsubNonFinal = window.api.onTokensNonfinal((tokens) => {
  // Capture scroll position before mutation
  let wasNearBottom = false;
  const rootElement = editor.getRootElement();
  if (rootElement) {
    const container = rootElement.parentElement;
    if (container) {
      wasNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    }
  }

  controller.handleNonFinalTokens(tokens);

  // Scroll to follow ghost text only when:
  // 1. User was already near the bottom (don't hijack scroll position)
  // 2. Content actually overflows the visible area after ghost text is rendered
  if (wasNearBottom && rootElement) {
    const container = rootElement.parentElement;
    if (container) {
      const overflow = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (overflow > 0) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }
});
```

**Why both guards are needed**:
- `wasNearBottom`: Prevents hijacking scroll position when the user scrolled up to read earlier text
- `overflow > 0`: Prevents scrolling when content fits within the container (fixes the reported bug)

Reading `scrollHeight` after the CSS variable mutation forces a synchronous layout reflow, so the ghost text height is reflected.

### Step 2: Apply the same overflow guard to TokenCommitPlugin.tsx

**File**: `src/renderer/overlay/editor/TokenCommitPlugin.tsx`

For consistency, add the same overflow check to the final-token scroll logic (lines 137–145). The same class of bug could occur when the first final tokens arrive and don't actually overflow:

```typescript
if (cursorAtEnd && wasNearBottom) {
  const rootElement = editor.getRootElement();
  if (rootElement) {
    const container = rootElement.parentElement;
    if (container) {
      const overflow = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (overflow > 0) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }
}
```

This is a minimal addition (one extra `if` guard around the existing `scrollTop` assignment) with no risk of regression.

## Risks / Open Questions

- **Layout reflow timing**: Reading `scrollHeight` after setting a CSS variable forces a synchronous layout reflow. This is a well-known browser behaviour but worth verifying manually.
- **Test coverage**: The scroll-follow logic depends on DOM layout (`scrollHeight`, `clientHeight`) which jsdom does not compute (all values are 0 in jsdom). Unit testing this scroll behaviour would require either a real browser environment (Playwright/Puppeteer) or extensive mocking of layout properties. The fix is small and mechanical (adding one conditional guard), so manual verification is appropriate. The existing `ghost-text.test.ts` tests cover the CSS variable logic which is unaffected.
