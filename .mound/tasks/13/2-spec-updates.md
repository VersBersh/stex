# Spec Updates — T13: Token Commit & EditorBlock Management

No spec updates required.

The existing specs fully describe the required behavior:
- `spec/models.md` defines `EditorBlock` interface, ownership rules, block boundary rules, and undo/redo scope
- `spec/api.md` defines the client-side processing flow (`commitToEditor`, `updateGhostText`)
- `spec/features/realtime-transcription.md` describes the token commit flow

The task description's scope and acceptance criteria are consistent with these specs. The `EditorBlock` interface already exists in `src/shared/types.ts` matching the spec. The IPC channels are already defined and wired. The implementation simply needs to add the renderer-side logic that consumes these events.
