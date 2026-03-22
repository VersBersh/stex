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
3. **Incoming tokens extend or create blocks**: Each batch of finalized tokens from Soniox extends the last block if it is `source: "soniox"` and `modified: false`. Otherwise, a new block with `source: "soniox"`, `modified: false` is created.
4. **Block alternation**: Blocks alternate by source at boundaries. When the user types after a soniox block, a new user block starts. When new tokens arrive after a user block or a modified soniox block, a new soniox block starts.
5. **Detecting mid-document edits**: The block manager tracks cumulative character offsets for each block. When a user-initiated text change occurs (excluding programmatic `'historic'`-tagged updates), the block manager determines whether the edit is at the document tail or within existing text:
   - **Tail insertion** (edit offset equals total document length): creates or extends a `source: "user"` block per the inline-typing block boundary rules
   - **Mid-document edit** (edit offset < total document length): maps the offset to the affected block(s); if a block has `source: "soniox"` and `modified: false`, sets `modified: true`; updates block `text` to reflect the edit
   - **Cross-block edits** (select+replace spanning multiple blocks): all affected blocks are marked `modified: true` and the replacement text is applied to the first affected block; fully consumed subsequent blocks are removed

### Mapping to Lexical

EditorBlocks are **not** 1:1 with Lexical nodes. The Lexical editor uses standard `ParagraphNode` and `TextNode` types. The block list is maintained as a separate data structure alongside the editor state. Block boundaries are tracked by character offset ranges within the document. This avoids the complexity of custom Lexical node types while still preserving ownership metadata.

Paragraph boundaries in Lexical (multiple `ParagraphNode` children of the root) are represented as newline characters within block text, matching the separator returned by Lexical's `$getRoot().getTextContent()` (currently `\n\n`). When a user splits or joins paragraphs, these characters are inserted or removed via the standard `applyEdit` mechanism — no special handling is needed. The block manager's offset model (character-level) naturally accounts for them as regular characters.

### Undo/Redo Scope

Only user edits (typing, deleting, pasting) are part of the Lexical undo history. Programmatic appends of transcribed text are **not** undoable — `Ctrl+Z` never removes transcription output.

#### Block Manager Synchronization

The block manager's full state (block text, structure, and `modified` flags) must be kept in sync with Lexical's undo/redo operations:

- Before each user edit is applied to the block manager, a snapshot of the entire `EditorBlock[]` array is captured and stored in a parallel undo stack.
- When the user undoes an edit (`Ctrl+Z`), the block manager restores the full block state from the corresponding snapshot.
- When the user redoes an edit (`Ctrl+Y`), the block manager restores the post-edit block state.
- Parallel stacks are cleared when transcription tokens are committed (since the Lexical undo/redo stacks are also cleared at that point).

This ensures that undoing an edit reverts both the block text and the `modified` flag to their pre-edit values, keeping the block manager aligned with the editor state and preventing unnecessary block fragmentation.

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

Persisted user preferences. This interface defines both the on-disk schema (what is stored in `settings.json`) and the shape returned by `getSettings()` at runtime. For most fields the stored and returned values are identical, but some fields undergo runtime resolution — see [Stored vs Effective Settings](#stored-vs-effective-settings) below.

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

### Stored vs Effective Settings

`getSettings()` returns **effective** settings — the values consumers actually use at runtime. For most fields, the effective value is simply the stored value (with defaults applied by `electron-store` for any missing keys). The following fields have additional resolution:

| Field | Resolution precedence |
|-------|----------------------|
| `sonioxApiKey` | Non-empty saved value > `SONIOX_API_KEY` environment variable > empty string |

The resolved environment variable value is **never** persisted back to `settings.json`, so `getSettings()` may return a `sonioxApiKey` derived from the environment that does not appear on disk.

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
