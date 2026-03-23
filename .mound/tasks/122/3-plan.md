# Plan

## Goal

Add finalization timeout details (5-second timeout, graceful degradation) to `spec/api.md` and three feature specs so they are consistent.

## Steps

### Step 1: Update `spec/api.md` — Add explicit 5-second timeout duration

**File**: `spec/api.md`, line 250

**Current text**:
```
Finalization sends an empty binary frame to signal end-of-utterance. The server will finalize remaining tokens and respond with `finished: true`. The client waits for this response before proceeding, with a timeout to prevent hangs (proceeds anyway if the server does not respond in time).
```

**New text**:
```
Finalization sends an empty binary frame to signal end-of-utterance. The server will finalize remaining tokens and respond with `finished: true`. The client waits for this response before proceeding, with a **5-second timeout** to prevent hangs. If the timeout expires, the client proceeds anyway (graceful degradation).
```

**Rationale**: The existing text mentions a timeout but not the specific duration. The code uses `FINALIZATION_TIMEOUT_MS = 5000` (`src/main/session.ts:14`). The feature specs will reference this section, so it needs the concrete value.

### Step 2: Update `spec/features/inline-editing.md` — Pause Semantics

**File**: `spec/features/inline-editing.md`, line 85

**Current text** (step 3 of Pause Semantics):
```
3. **Wait for `finished: true`** — the app waits for Soniox to return the finalized response (this may take longer on slow connections, which is fine)
```

**New text**:
```
3. **Wait for `finished: true`** — the app waits for Soniox to return the finalized response, subject to a 5-second timeout (see [api.md — Manual Finalization](../api.md#manual-finalization)). If the timeout expires, the app proceeds to the paused state anyway (the WebSocket remains open, so late-arriving final tokens may still be delivered).
```

**Rationale**: Replaces the vague "which is fine" with the concrete timeout behavior. Notes that on pause the WebSocket stays open, so late tokens are not necessarily lost (review issue #2).

### Step 3: Update `spec/features/realtime-transcription.md` — Ending a Session

**File**: `spec/features/realtime-transcription.md`, line 31

**Current text** (step 3 of Ending a Session):
```
  3. App waits for the `finished: true` response (may take a moment on slow connections)
```

**New text**:
```
  3. App waits for the `finished: true` response, subject to a 5-second timeout (see [api.md — Manual Finalization](../api.md#manual-finalization)). If the timeout expires, the app proceeds anyway.
```

### Step 4: Update `spec/features/text-output.md` — Clipboard behavior

**File**: `spec/features/text-output.md`, line 13

**Current text** (step 3 of the Clipboard numbered list):
```
  3. The app waits for the `finished: true` response (this may take a moment on slow connections)
```

**New text**:
```
  3. The app waits for the `finished: true` response, subject to a 5-second timeout (see [api.md — Manual Finalization](../api.md#manual-finalization)). If the timeout expires, the app proceeds anyway.
```

## Risks / Open Questions

- **Conditionality of stop finalization**: The review noted that `realtime-transcription.md` and `text-output.md` describe finalization as unconditional during stop/hide, while `api.md` documents it as conditional. This is a pre-existing inconsistency outside the scope of this task (which is specifically about timeout details). A separate task could align the stop flow steps with the conditional behavior in `api.md`.
- **Link format**: Cross-references use `../api.md#manual-finalization`. This is correct for `spec/features/*.md` → `spec/api.md`.
