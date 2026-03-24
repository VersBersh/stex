# Fix Soniox config: add finalize_on_end for endpoint detection

## Summary

The Soniox WebSocket config in `src/main/soniox.ts:75-85` sends `enable_endpoint_detection: true` and `max_endpoint_delay_ms` but is missing `finalize_on_end: true`. The Soniox API requires this flag when endpoint detection is configured.

The server explicitly rejected the config with: `400 — max_endpoint_delay_ms can only be set if finalize_on_end is true`.

This is the root cause of transcription completely failing. The logs show two failure modes:
- **Early sessions:** Server immediately closes WebSocket (code=1000) ~200ms after receiving the config. No transcription possible.
- **Later sessions:** Connection stays open, audio flows for 20-30s, but zero tokens are returned. Finalization always times out. Eventually Soniox sends `408 — Request timeout`.

## Acceptance criteria

- The Soniox config object includes `finalize_on_end: true` when `enable_endpoint_detection` is enabled
- Check the Soniox API docs to confirm the correct config semantics and whether the empty-buffer finalization mechanism (`soniox.ts:117` — `Buffer.alloc(0)`) is still the correct way to signal end-of-audio with this flag
- Transcription produces tokens when audio is captured (manual verification)
- Existing tests pass

## References

- `src/main/soniox.ts` — WebSocket client, config construction (line 75-85), finalize method (line 115-118)
- `src/main/soniox-lifecycle.ts` — lifecycle management, connectSoniox()
- Log evidence: `C:\Users\oliver.chambers\AppData\Roaming\stex\logs\stex.log` — line 117 shows the 400 error
