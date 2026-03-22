# Spec Updates

## Spec changes required

### 1. `spec/architecture.md` — Add IPC channels for window hide

The architecture spec's IPC Messages table does not include a channel for the renderer to request hiding the overlay window. The overlay UI needs this for:
- TitleBar hide button
- Escape key dismiss

**Proposed addition** to IPC Messages table:

| Direction | Channel | Payload | Purpose |
|-----------|---------|---------|---------|
| Renderer → Main | `window:hide` | — | Hide the overlay window (title bar button or Escape key) |

### 2. `spec/architecture.md` — Add preload script to file structure

The file structure section doesn't mention a preload script, but one is needed for `contextBridge.exposeInMainWorld` to enable renderer-to-main IPC with `contextIsolation: true`.

**Proposed addition** to file structure:

```
stex/
  src/
    main/
      preload.ts            # Preload script: exposes IPC bridge via contextBridge
```

## New spec content

No new spec files needed. The additions above are minor augmentations to the existing architecture spec.
