# Struggles

## 1
- **Category**: spec-clarity
- **What happened**: The spec says `connectionBaseMs = replayStartMs` for replay, but the ring buffer API (`sliceFrom`) is chunk-granular — it returns data starting from the containing chunk, not byte-precise at the requested timestamp. This creates a subtle timestamp misalignment that the plan reviewer correctly flagged. Determining the right fix (add `sliceFromWithStart()` to expose the actual chunk start) required understanding both the spec's intent and the ring buffer's behavior.
- **What would have helped**: The spec could note that replay audio extraction is chunk-aligned and that `connectionBaseMs` should use the actual start time of the first replayed chunk rather than the requested `replayStartMs`.

## 2
- **Category**: description-quality
- **What happened**: The task description scopes this as an audio-pipeline task, but the plan reviewer flagged it as Critical because the renderer-side ghost text conversion is required for end-to-end correctness. The task description doesn't explicitly state that the renderer work is a separate task, leading to ambiguity about scope. I had to reason about whether this was the audio half or the full implementation.
- **What would have helped**: The task description could explicitly note "This is the main-process audio pipeline task. Renderer-side ghost text conversion is handled by task N" to remove scope ambiguity.

## 3
- **Category**: orientation
- **What happened**: Understanding the Soniox finalization model (empty buffer triggers connection close due to `finalize_on_end: true`) was essential for designing the drain detection strategy. This isn't documented in the spec — I had to read `soniox.ts` and trace through `handleDisconnect` to understand that mid-stream finalization isn't possible.
- **What would have helped**: A note in the spec's "Connection handoff" section explaining that Soniox finalization closes the connection, and that replay drain must be detected via token callbacks rather than explicit finalization.
