# Plan

## Goal

Add `finalize_on_end: true` to the Soniox WebSocket config object so endpoint detection works correctly.

## Steps

1. **Edit `src/main/soniox.ts`** — Add `finalize_on_end: true` to the config object at line 82, alongside the existing `enable_endpoint_detection: true`.

2. **Edit `src/main/soniox.test.ts`** — Update the config assertion in the "sends configuration message on open" test (line 115-124) to include `finalize_on_end: true`.

3. **Run tests** — Verify all soniox tests pass.

## Risks / Open Questions

None — the error message from the Soniox API (`max_endpoint_delay_ms can only be set if finalize_on_end is true`) makes the fix unambiguous. The empty-buffer finalization mechanism (`Buffer.alloc(0)`) is the standard way to signal end-of-audio when `finalize_on_end` is true.
