# Spec Updates — Task 150: Track connectionBaseMs and offset Soniox token timestamps

## Spec changes required

### 1. `spec/models.md` — Clarify `SonioxToken` timestamp semantics

**What changes:** The `SonioxToken` description (line 5) currently says "A single token received from the Soniox WebSocket API." After this task, `SonioxToken` values forwarded over IPC to the renderer have `start_ms`/`end_ms` offset to session audio time by the lifecycle layer. The type definition itself doesn't change, but the documentation should clarify the two contexts in which the type is used.

**Proposed change:** Update the description paragraph for `SonioxToken` from:

> A single token received from the Soniox WebSocket API.

To:

> A single token from the Soniox transcription pipeline. Inside `SonioxClient`, `start_ms` and `end_ms` are connection-relative (reset to 0 for each new WebSocket). The lifecycle layer (`soniox-lifecycle.ts`) offsets these timestamps by `connectionBaseMs` before forwarding to consumers, so tokens received via IPC or lifecycle callbacks have `start_ms`/`end_ms` in session audio time — a monotonic timeline spanning the entire dictation session regardless of connection handoffs.

**Why:** Without this clarification, a developer reading `spec/models.md` would assume `SonioxToken.start_ms` is always raw Soniox output, which is no longer true for tokens beyond the lifecycle boundary.

## New spec content

None required — the `connectionBaseMs` concept is already fully described in `spec/proposal-context-refresh.md`.
