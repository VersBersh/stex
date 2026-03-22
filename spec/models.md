# Data Models

## SonioxToken

A single token received from the Soniox WebSocket API.

```typescript
interface SonioxToken {
  text: string;
  start_ms: number;
  end_ms: number;
  confidence: number;
  is_final: boolean;
  speaker?: string;
}
```

## TranscriptSegment

A contiguous run of finalized text from a single Soniox response batch. Multiple tokens are collapsed into a segment once finalized.

```typescript
interface TranscriptSegment {
  id: string;           // unique segment ID
  text: string;         // concatenated token text
  source: "soniox";     // origin — always soniox for auto-generated segments
  startMs: number;      // audio timestamp of first token
  endMs: number;        // audio timestamp of last token
  confidence: number;   // average confidence across tokens
}
```

## EditorBlock

A logical segment of text in the editor. The editor maintains an ordered list of EditorBlocks that together represent the full document. Each block tracks who originally produced it and whether the user has modified it.

```typescript
interface EditorBlock {
  id: string;
  text: string;
  source: "soniox" | "user";  // who originally produced this text
  modified: boolean;           // true if user has edited a soniox block
}
```

### Ownership Rules

1. **Provenance is preserved**: When a user edits a `soniox` block, `source` stays `"soniox"` but `modified` flips to `true`. This prevents any future overwrite by incoming tokens.
2. **User typing creates new blocks**: When the user types new text (not editing existing text), a new block with `source: "user"` is created. See [inline-typing](features/inline-typing.md) for block boundary rules.
3. **Incoming tokens create new blocks**: Each batch of finalized tokens from Soniox creates a new block with `source: "soniox"`, `modified: false`.
4. **Block boundaries**: Blocks alternate by source. Consecutive tokens from Soniox are merged into the same block. When the user types after a soniox block, a new user block starts. When new tokens arrive after a user block, a new soniox block starts.

### Mapping to Lexical

EditorBlocks are **not** 1:1 with Lexical nodes. The Lexical editor uses standard `ParagraphNode` and `TextNode` types. The block list is maintained as a separate data structure alongside the editor state. Block boundaries are tracked by character offset ranges within the document. This avoids the complexity of custom Lexical node types while still preserving ownership metadata.

### Undo/Redo Scope

Only user edits (typing, deleting, pasting) are part of the Lexical undo history. Programmatic appends of transcribed text are **not** undoable — `Ctrl+Z` never removes transcription output.

## GhostText

The current non-final tokens being displayed at the tail of the document. This is ephemeral — it gets replaced with every new Soniox response.

```typescript
interface GhostText {
  tokens: SonioxToken[];  // current non-final tokens
  text: string;           // concatenated display text
}
```

## SessionState

Top-level state for an active transcription session.

```typescript
interface SessionState {
  status: "idle" | "connecting" | "recording" | "paused" | "finalizing" | "error";
  blocks: EditorBlock[];
  ghostText: GhostText | null;
  websocketConnected: boolean;
  microphoneActive: boolean;
  error?: string;
}
```

## AppSettings

Persisted user preferences.

```typescript
interface AppSettings {
  hotkey: string;                  // e.g. "Ctrl+Shift+Space"
  launchOnStartup: boolean;
  onHide: "clipboard" | "none";   // what to do with text when window hides
  onShow: "fresh" | "append";     // "fresh" clears editor on show, "append" keeps previous text
  audioInputDevice: string | null;  // PortAudio device name, null = system default
  sonioxApiKey: string;
  sonioxModel: string;             // Soniox model identifier
  language: string;                // language hint for Soniox
  maxEndpointDelayMs: number;      // 500–3000, controls finalization speed
  theme: "system" | "light" | "dark";
  windowPosition: { x: number; y: number } | null;
  windowSize: { width: number; height: number };
}
```

## TranscriptionRecord

Stored after each session for history (future feature).

```typescript
interface TranscriptionRecord {
  id: string;
  text: string;              // final corrected text
  createdAt: string;         // ISO timestamp
  durationMs: number;        // session duration
  language: string;
}
```
