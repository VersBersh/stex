# Spec Updates for T10: Soniox WebSocket Client

No spec updates required.

The existing specs fully cover this task:
- `spec/api.md` defines the WebSocket endpoint, configuration message format, response format, token lifecycle, and client-side processing algorithm
- `spec/models.md` defines `SonioxToken` and `AppSettings` interfaces (already implemented in `src/shared/types.ts`)
- `spec/architecture.md` defines the Soniox Client component responsibilities

The `SonioxResponse` type (containing `tokens`, `audio_final_proc_ms`, `audio_total_proc_ms`, `finished`) is implied by `spec/api.md` but not explicitly defined in `spec/models.md`. This type will be defined locally in `soniox.ts` as it is an internal wire format, not a shared domain model.
