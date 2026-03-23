# Spec Updates

## Spec changes required

### 1. `spec/models.md` — Remove `disconnected` from `SessionState.status` union

**Line 95:** Remove `"disconnected" |` from the status union type.

**Why:** The `disconnected` value is never emitted at runtime. `handleDisconnect()` transitions directly to `reconnecting` or `error`.

### 2. `spec/architecture.md` — Remove `disconnected` from IPC message table

**Line 124:** Remove `, \`disconnected\`` from the `session:status` values list.

**Why:** Same as above — the architecture spec should match actual runtime behavior.

### 3. `spec/api.md` — Rewrite WebSocket disconnect row

**Line 127:** The current spec describes showing "Disconnected" then "Reconnecting..." then "Reconnected", but the runtime goes directly to `reconnecting` and then `paused` after successful reconnect. Rewrite to match actual behavior.

**Why:** The spec was written aspirationally before implementation; the code never implemented a separate `disconnected` or `reconnected` state.

### 4. `spec/ui.md` — Replace "Disconnected" with "Reconnecting..."

**Line 85:** Change the example status text from `"Disconnected"` to `"Reconnecting..."` to match the actual status text shown during network errors.

**Why:** The status bar never shows "Disconnected" — it shows "Reconnecting..." when the WebSocket drops.

### 5. `spec/features/realtime-transcription.md` — Replace "Disconnected" with "Reconnecting..."

**Line 36:** Change `show "Disconnected" in status bar` to `show "Reconnecting..." in status bar`.

**Why:** Same as above — matches actual runtime behavior.

## New spec content

None required.
