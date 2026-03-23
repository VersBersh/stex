# Spec Updates Required

## Changes to existing spec files

### 1. `spec/api.md` — Manual Finalization (line 250)

**Current**: "...with a timeout to prevent hangs (proceeds anyway if the server does not respond in time)."

**Change**: Make the 5-second timeout duration explicit: "...with a **5-second timeout** to prevent hangs. If the timeout expires, the client proceeds anyway (graceful degradation)."

**Why**: The code uses `FINALIZATION_TIMEOUT_MS = 5000` but the spec only says "a timeout" without a specific duration. The feature specs will reference this section, so it needs the concrete value.

### 2. `spec/features/inline-editing.md` — Pause Semantics (line 85)

**Current**: "**Wait for `finished: true`** — the app waits for Soniox to return the finalized response (this may take longer on slow connections, which is fine)"

**Change**: Replace the parenthetical with timeout details and a cross-reference to api.md. Note that the WebSocket remains open on pause, so late tokens may still arrive.

**Why**: Describes the same finalization handshake as api.md but omits the timeout, implying indefinite waiting.

### 3. `spec/features/realtime-transcription.md` — Ending a Session (line 31)

**Current**: "App waits for the `finished: true` response (may take a moment on slow connections)"

**Change**: Add timeout details and cross-reference to api.md.

**Why**: Same inconsistency — describes waiting for `finished: true` without mentioning the timeout.

### 4. `spec/features/text-output.md` — Clipboard / Finalizing state (line 13)

**Current**: "The app waits for the `finished: true` response (this may take a moment on slow connections)"

**Change**: Add timeout details and cross-reference to api.md.

**Why**: Same inconsistency.

## New spec content

None required.
