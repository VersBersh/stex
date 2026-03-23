# Plan

## Goal

Update `spec/api.md` to accurately reflect the current Soniox WebSocket protocol as implemented in the codebase.

## Steps

### Step 1: Fix endpoint URL
- **File**: `spec/api.md`
- **Change**: Replace `wss://stt.soniox.com/transcribe` with `wss://stt-rt.soniox.com/transcribe-websocket`
- **Source**: `src/main/soniox.ts:5`

### Step 2: Fix configuration message
- **File**: `spec/api.md`
- **Changes**:
  - Change `"model": "stt-rt-preview"` to `"model": "stt-rt-v4"` and note in surrounding text that `model` is a configurable setting (the value shown is the current default)
  - Add `"enable_endpoint_detection": true` field
- **Source**: `src/main/soniox.ts:66-74`, `src/main/settings.ts:50`

### Step 3: Fix response format
- **File**: `spec/api.md`
- **Changes**:
  - Rename `audio_final_proc_ms` to `final_audio_proc_ms`
  - Rename `audio_total_proc_ms` to `total_audio_proc_ms`
  - Add `finished?: boolean` to response documentation
  - Add `error_code?: string` and `error_message?: string` to response documentation
  - Add `speaker?: string` optional field to token documentation
  - Show a separate error response example
- **Source**: `src/main/soniox.ts:16-23`, `src/shared/types.ts:1-8`

### Step 4: Rewrite token lifecycle section
- **File**: `spec/api.md`
- **Changes**: Rewrite the "Key rules" to accurately reflect the implementation:
  1. Non-final tokens are ephemeral — each response replaces all previous non-final tokens
  2. Final tokens may be re-sent by the server across responses — they are not guaranteed to appear only once
  3. `is_final` on each token determines whether it is final or non-final
  4. `final_audio_proc_ms` is a watermark — compare each final token's `start_ms` against the last-seen `final_audio_proc_ms` to identify only **new** final tokens and avoid processing duplicates
- **Source**: `src/main/soniox.ts:139-149`

### Step 5: Update client-side processing pseudocode
- **File**: `spec/api.md`
- **Changes**:
  - Fix field name from `audio_final_proc_ms` to `final_audio_proc_ms`
  - Update the pseudocode to accurately reflect the deduplication logic: use `is_final` to split tokens, use `start_ms >= lastFinalProcMs` watermark to find new finals
  - Match the actual implementation in `soniox.ts:139-157`
- **Source**: `src/main/soniox.ts:119-163`

### Step 6: Rewrite error handling section
- **File**: `spec/api.md`
- **Changes**: Replace the simple error table with structured subsections:
  - **Server error responses**: JSON responses with `error_code` / `error_message` fields
  - **WebSocket disconnect classification**:
    - Code 1000 (Normal closure): non-reconnectable by default, refined by reason text
    - Codes 1001, 1006, 1011: reconnectable (network errors)
    - Code 1008 (Policy violation): non-reconnectable, refined by reason text
    - Fallback for all other codes (including 4000-4999): refined by reason text, default reconnectable
    - Reason text classification: "api key"/"unauthorized"/"authentication" → non-reconnectable api-key error; "rate limit"/"quota"/"too many" → non-reconnectable rate-limit error
  - **Reconnect behavior**: exponential backoff (1s, 2s, 4s, ..., max 30s), on success → transition to paused (user must manually resume), audio not buffered during disconnect
  - **Audio capture errors**: mic-denied, mic-unavailable
- **Source**: `src/main/error-classification.ts`, `src/main/reconnect-policy.ts`, `src/main/soniox-lifecycle.ts:69-85`

### Step 7: Update manual finalization section
- **File**: `spec/api.md`
- **Changes**:
  - **On pause**: Always sends empty frame and waits for `finished: true`
  - **On hide (stop)**: Finalization is **conditional** — only sends empty frame if WebSocket is connected AND there are pending non-final tokens. Otherwise skips straight to cleanup.
  - **Finalization timeout**: 5 seconds; if timeout expires, proceeds anyway (graceful degradation)
  - **Clipboard copy**: Only happens when `onHide` setting is `'clipboard'`
  - **Quick dismiss (Escape)**: Skips finalization entirely — stops capture, closes WebSocket, hides window immediately
  - Keep phrasing consistent with other feature specs that reference `finished: true` without mentioning timeout details (per review feedback item 4 — avoid creating cross-spec inconsistency)
- **Source**: `src/main/session.ts:13,19-42,77-91,109-142,175-191`

## Risks / Open Questions

- The `speaker` field on tokens is in the type definition but may not be actively used by the current model. Including it as optional is correct.
- Review item 4 (Minor) notes that `spec/features/inline-editing.md`, `spec/features/realtime-transcription.md`, and `spec/features/text-output.md` reference `finished: true` without timeout details. To avoid cross-spec inconsistency, Step 7 will mention the timeout in `api.md` but keep the phrasing compatible (e.g., "waits for `finished: true`, with a timeout to prevent hangs"). Updating other spec files is out of scope for this task.
- The spec currently describes "Ctrl+P" for resume — this is a UI detail not in scope for this protocol-level update.
