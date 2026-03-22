# Plan

## Goal

Replace all 3 direct `$getRoot().getTextContent()` calls in `OverlayContext.tsx` with the shared `$getDocumentText()` helper from `lexicalTextContract.ts`.

## Steps

### Step 1: Update imports in `OverlayContext.tsx`

**File:** `src/renderer/overlay/OverlayContext.tsx`

- Add import: `import { $getDocumentText } from './editor/lexicalTextContract';`
- Remove `$getRoot` from the `lexical` import (line 3), since `$getRoot` is still used on line 53 for `$getRoot().clear()` — so `$getRoot` must **remain** in the import. Only `$getRoot().getTextContent()` calls are being replaced, not `$getRoot().clear()`.

Actually, `$getRoot` is used in 4 places:
- Line 53: `$getRoot().clear()` — keep (not a text serialization call)
- Line 64: `$getRoot().getTextContent()` — replace
- Line 102: `$getRoot().getTextContent()` — replace
- Line 170: `$getRoot().getTextContent()` — replace

So `$getRoot` must remain in the lexical import for the `.clear()` usage.

Changes:
- Add `import { $getDocumentText } from './editor/lexicalTextContract';` after line 3

### Step 2: Replace `isEditorEmpty` call (line 64)

**File:** `src/renderer/overlay/OverlayContext.tsx`

Replace:
```ts
const text = $getRoot().getTextContent();
```
with:
```ts
const text = $getDocumentText();
```

### Step 3: Replace `copyText` call (line 102)

**File:** `src/renderer/overlay/OverlayContext.tsx`

Replace:
```ts
const text = $getRoot().getTextContent();
```
with:
```ts
const text = $getDocumentText();
```

### Step 4: Replace `onRequestSessionText` call (line 170)

**File:** `src/renderer/overlay/OverlayContext.tsx`

Replace:
```ts
const text = $getRoot().getTextContent();
```
with:
```ts
const text = $getDocumentText();
```

### Step 5: Verify no remaining `getTextContent` calls

Confirm no `$getRoot().getTextContent()` calls remain in `OverlayContext.tsx`.

### Step 6: Build and test

Run the project build and any existing tests to verify no regressions.

## Risks / Open Questions

- **Minimal risk**: This is a 1:1 mechanical replacement. `$getDocumentText()` is literally `$getRoot().getTextContent()` wrapped in a function. Behavior is identical.
- The `$getRoot` import must remain because it's still used for `$getRoot().clear()` on line 53.
