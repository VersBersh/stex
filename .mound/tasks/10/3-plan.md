# Plan for T10: Soniox WebSocket Client

## Goal

Implement the Soniox WebSocket client (`src/main/soniox.ts`) that connects to the Soniox streaming API, sends audio frames as binary WebSocket messages, parses token responses with `audio_final_proc_ms` tracking, and emits typed events for final tokens, non-final tokens, connection state, and finalization.

## Steps

### 1. Add `ws` dependency

**File**: `package.json`

Add `ws` to `dependencies` and `@types/ws` to `devDependencies`. Run `npm install` to update `package-lock.json`.

```
dependencies: "ws": "^8.18.0"
devDependencies: "@types/ws": "^8.5.13"
```

### 2. Add `ws` to webpack externals

**File**: `webpack.main.config.js`

Add `ws` to the `externals` object so webpack doesn't try to bundle it:

```js
externals: {
  electron: 'commonjs electron',
  'electron-store': 'commonjs electron-store',
  ws: 'commonjs ws',
},
```

### 3. Define internal types in soniox.ts

**File**: `src/main/soniox.ts`

Define the wire-format response type and the event listener interface:

```typescript
import WebSocket from 'ws';
import { SonioxToken, AppSettings } from '../shared/types';

/** Wire format of a Soniox WebSocket response */
interface SonioxResponse {
  tokens: SonioxToken[];
  audio_final_proc_ms: number;
  audio_total_proc_ms: number;
  finished?: boolean;
}

/** Event listeners for the Soniox client */
interface SonioxClientEvents {
  onFinalTokens: (tokens: SonioxToken[]) => void;
  onNonFinalTokens: (tokens: SonioxToken[]) => void;
  onFinished: () => void;
  onConnected: () => void;
  onDisconnected: (reason: string) => void;
  onError: (error: Error) => void;
}
```

### 4. Implement the SonioxClient class

**File**: `src/main/soniox.ts`

Create the `SonioxClient` class with these members:

**Constructor**: `constructor(events: Partial<SonioxClientEvents>)`
- Stores event callbacks. All callbacks are optional (Partial).

**Private state**:
- `ws: WebSocket | null` — current WebSocket connection
- `lastFinalProcMs: number` — tracks the `audio_final_proc_ms` watermark for identifying new final tokens
- `events: Partial<SonioxClientEvents>` — event callbacks

**`connect(settings: AppSettings): void`**
- If already connected, disconnect first
- Creates a new WebSocket to `wss://stt.soniox.com/transcribe`
- Captures `const socket = this.ws` in the closure so all event handlers check `socket === this.ws` before emitting, preventing stale socket events after disconnect/reconnect
- On `open`: sends the JSON configuration message using relevant fields from `settings` (sonioxApiKey, sonioxModel, language, maxEndpointDelayMs), then emits `onConnected`
- On `message`: calls `handleMessage(data)`
- On `close`: emits `onDisconnected` with close reason (only if socket is still current)
- On `error`: emits `onError` (only if socket is still current)
- Resets `lastFinalProcMs = 0`

Note: `connect()` accepts `settings` as a parameter rather than reading from the Settings Store directly. This enables dependency inversion — the Session Manager reads settings and passes them in, making the Soniox Client testable without mocking the Settings Store.

**`sendAudio(chunk: Buffer): void`**
- Sends the chunk as a binary WebSocket frame
- No-op if WebSocket is not open

**`finalize(): void`**
- Sends an empty Buffer (0-length binary frame) to signal end of stream
- No-op if WebSocket is not open

**`disconnect(): void`**
- Removes all listeners from the WebSocket to prevent stale events
- Closes the WebSocket connection if open
- Sets `ws = null`

**`private handleMessage(data: WebSocket.Data): void`**
- Parses JSON response as `SonioxResponse`
- **Process tokens first** (before checking `finished`), so tokens in the final response are not dropped:
  - New final tokens: `response.tokens.filter(t => t.is_final && t.start_ms >= this.lastFinalProcMs)`
  - Non-final tokens: `response.tokens.filter(t => !t.is_final)`
  - If new final tokens exist: emits `onFinalTokens(newFinalTokens)` and updates `lastFinalProcMs = response.audio_final_proc_ms`
  - If non-final tokens exist: emits `onNonFinalTokens(nonFinalTokens)`
- **Then** if `response.finished === true`: emits `onFinished()`

**`get connected(): boolean`**
- Returns `true` if `ws` is not null and in `OPEN` state

### 5. Export the class and types

**File**: `src/main/soniox.ts`

Export `SonioxClient`, `SonioxClientEvents`, and `SonioxResponse`.

## Risks / Open Questions

1. **No `ws` package currently in the project** — Step 1 adds it. Low risk — `ws` is the standard Node WebSocket library and works in Electron main process.

2. **Error handling granularity** — Per `spec/api.md`, reconnection with exponential backoff is handled by Session Manager, not the Soniox Client. This module only emits the error/disconnect events.

3. **`connect(settings)` vs `connect()`** — The task description says "all from Settings Store" and lists `connect()` / `disconnect()` as the lifecycle API. We deviate by accepting `settings` as a parameter for testability (dependency inversion). The Session Manager will call `connect(getSettings())`. This is a deliberate design choice documented here rather than a spec inconsistency.

4. **`spec/architecture.md` says Soniox Client forwards to renderer via IPC** — Our implementation does not own IPC; Session Manager handles forwarding. This is a spec imprecision rather than a conflict — the architecture diagram shows the correct data flow (Soniox Client → Session Manager → IPC → Renderer). Updating the spec is out of scope for this task.

5. **`spec/api.md` ambiguity about final token resending** — The spec says final tokens "appear once and are never re-sent" but also says to track `audio_final_proc_ms`. In practice, Soniox responses include all final tokens up to the watermark, so the `start_ms >= lastFinalProcMs` filter is necessary to deduplicate. The watermark algorithm from the spec is correct and handles both interpretations.
