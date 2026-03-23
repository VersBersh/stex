# Spec Updates Required

All changes are to `spec/api.md`. The spec currently documents an older version of the Soniox protocol and needs to be updated to match the implementation.

## Changes Required

### 1. Endpoint URL (Critical)
- **Current spec**: `wss://stt.soniox.com/transcribe`
- **Actual code** (`soniox.ts:5`): `wss://stt-rt.soniox.com/transcribe-websocket`
- **Why**: Wrong endpoint URL would prevent connection.

### 2. Model name — configurable, not fixed (Major)
- **Current spec**: `"model": "stt-rt-preview"` presented as a fixed value
- **Actual code** (`soniox.ts:68`, `settings.ts:50`): `settings.sonioxModel` is sent; default is `"stt-rt-v4"`
- **Why**: Model has changed and is configurable. Spec should show `stt-rt-v4` as the default/example and note it's configurable.

### 3. Missing config field: `enable_endpoint_detection` (Major)
- **Current spec**: Not present in config example
- **Actual code** (`soniox.ts:73`): `enable_endpoint_detection: true`
- **Why**: Required for `<end>` marker filtering to make sense.

### 4. Response field names (Critical)
- **Current spec**: `audio_final_proc_ms`, `audio_total_proc_ms`
- **Actual code** (`soniox.ts:18-19`): `final_audio_proc_ms`, `total_audio_proc_ms`
- **Why**: Field names don't match the actual protocol.

### 5. Missing response fields (Major)
- **Current spec**: Only shows `tokens`, `audio_final_proc_ms`, `audio_total_proc_ms`
- **Actual code** (`soniox.ts:16-23`): Also has `finished?: boolean`, `error_code?: string`, `error_message?: string`
- **Why**: Essential protocol fields for finalization and error signaling.

### 6. Missing token field: `speaker` (Minor)
- **Current spec**: Token only has `text`, `start_ms`, `end_ms`, `confidence`, `is_final`
- **Actual code** (`types.ts:7`): Also has `speaker?: string`
- **Why**: Optional field for multi-speaker scenarios.

### 7. Token lifecycle rules are semantically wrong (Major)
- **Current spec**: Says "Final tokens are permanent — they appear once and are never re-sent or modified"
- **Actual code** (`soniox.ts:140-141`): Final tokens CAN be re-sent by the server. The client uses `start_ms >= lastFinalProcMs` watermark to identify which final tokens are new.
- **Why**: The spec's rule 2 is factually incorrect. `is_final` determines token class; `final_audio_proc_ms` is a dedupe watermark, not a boundary marker.

### 8. Client-side pseudocode uses wrong field names and logic description (Major)
- **Current spec**: Uses `audio_final_proc_ms`, describes tracking as "based on audio_final_proc_ms advancing"
- **Actual code**: Uses `final_audio_proc_ms`, actual logic is `t.start_ms >= this.lastFinalProcMs`
- **Why**: Must match corrected field names and accurate deduplication semantics.

### 9. Error handling section needs rewrite (Major)
- **Current spec**: Simple 4-row table with vague handling descriptions
- **Actual code** (`error-classification.ts`): Structured classification by WebSocket close code with fallback path, reason-text refinement, reconnectable/non-reconnectable determination, audio error types
- **Why**: Spec should document actual error classification and reconnect logic.

### 10. Manual finalization conditions are inaccurate (Major)
- **Current spec**: Implies finalization always happens on hide
- **Actual code** (`session.ts:120`): On stop/hide, finalization only happens if `isConnected() && hasPendingNonFinalTokens()`. On pause, always finalizes. Quick dismiss skips finalization.
- **Why**: Spec should accurately document conditional finalization.

### 11. Missing finalization timeout (Minor)
- **Current spec**: "Wait for the `finished: true` response before proceeding" with no timeout
- **Actual code** (`session.ts:13,19`): 5-second timeout with graceful degradation
- **Why**: Important implementation detail that prevents hangs.

### 12. Clipboard copy is conditional (Minor)
- **Current spec**: "copy the full document text to clipboard, then hide"
- **Actual code** (`session.ts:129`): Only copies if `settings.onHide === 'clipboard'`
- **Why**: Behavior depends on user setting.

## No new spec files needed
All changes are updates to `spec/api.md`.
