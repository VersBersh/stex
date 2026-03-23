# Plan

## Goal

Filter out Soniox `<end>` endpoint detection markers from the token stream so they don't appear in transcription output.

## Steps

### Step 1: Add endpoint token filtering in `SonioxClient.handleMessage()`

**File:** `src/main/soniox.ts`

In the `handleMessage` method (line 109), after parsing the response and before separating final/non-final tokens, filter out tokens whose `text` is the `<end>` protocol marker.

Currently (lines 129-132):
```typescript
const newFinalTokens = response.tokens.filter(
  (t) => t.is_final && t.start_ms >= this.lastFinalProcMs,
);
const nonFinalTokens = response.tokens.filter((t) => !t.is_final);
```

Change to:
```typescript
const contentTokens = response.tokens.filter((t) => !isEndpointMarker(t));
const newFinalTokens = contentTokens.filter(
  (t) => t.is_final && t.start_ms >= this.lastFinalProcMs,
);
const nonFinalTokens = contentTokens.filter((t) => !t.is_final);
```

Add a helper function at module scope (not exported — internal concern):
```typescript
function isEndpointMarker(token: SonioxToken): boolean {
  return token.text === '<end>';
}
```

This approach:
- Filters at the service boundary (before tokens leave `SonioxClient`)
- Uses an exact string match for `<end>` — the known Soniox endpoint detection marker
- Is a pure predicate function, easy to extend if other markers are discovered later
- Follows the existing pattern of filtering tokens within `handleMessage`

### Step 2: Add unit tests for endpoint marker filtering

**File:** `src/main/soniox.test.ts`

Add a new `describe` block (`'endpoint marker filtering'`) within the existing test suite. Tests:

1. **Filters `<end>` token from final tokens** — send a response with a final `<end>` token alongside a normal final token. Assert `onFinalTokens` is called with only the normal token.

2. **Filters `<end>` token from non-final tokens** — send a response with a non-final `<end>` token alongside a normal non-final token. Assert `onNonFinalTokens` is called with only the normal token.

3. **Does not filter normal tokens** — send a response with normal tokens containing angle brackets in other patterns (e.g., `"<br>"`, `"end"`, `"<END>"`). Assert they pass through unchanged.

4. **Response with only `<end>` token emits neither callback** — send a response containing only a final `<end>` token. Assert neither `onFinalTokens` nor `onNonFinalTokens` is called.

Follow the existing test patterns using `makeResponse` helper and `socket.emit('message', ...)`.

### Step 3: Update `spec/api.md` Client-Side Processing section

**File:** `spec/api.md`

Update the "Client-Side Processing" section to add a filtering step and update the pseudocode.

In the numbered processing steps (line 94-98), add a step between parsing and separation:
```
1. Parse response
2. Filter out protocol markers (e.g. `<end>` endpoint detection tokens)
3. Separate final tokens (new ones only, based on audio_final_proc_ms advancing)
4. Commit new final tokens to the Lexical editor as EditorBlocks
5. Replace ghost text with current non-final tokens
```

In the pseudocode (lines 105-117), add the filtering line:
```typescript
function onMessage(response: SonioxResponse) {
  const contentTokens = response.tokens.filter(t => t.text !== '<end>');
  const newFinalTokens = contentTokens.filter(
    t => t.is_final && t.start_ms >= lastFinalProcMs
  );
  const nonFinalTokens = contentTokens.filter(t => !t.is_final);
  // ...
}
```

## Risks / Open Questions

1. **Exact match vs pattern**: The fix uses exact string match `=== '<end>'`. If Soniox ever changes the marker format (e.g. `<END>`, `<end/>`), this would need updating. Using exact match is safer than a regex to avoid accidentally filtering legitimate transcribed text containing "end".

2. **Other protocol markers**: If Soniox sends other protocol markers (e.g., `<start>`, `<silence>`), they would also need filtering. This fix only addresses the known `<end>` marker per the bug report. The `isEndpointMarker` function can be extended if others are discovered.

3. **Stale spec details**: The reviewer noted that `spec/api.md` has stale details (endpoint URL `wss://stt.soniox.com/transcribe` vs actual `wss://stt-rt.soniox.com/transcribe-websocket`, field name `audio_final_proc_ms` vs code's `final_audio_proc_ms`). These are pre-existing spec drift issues outside the scope of this bug fix. Noted as discovered work for a separate task.
