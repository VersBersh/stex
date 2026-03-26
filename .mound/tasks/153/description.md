# Capture Pending (Unfinalized) Token Start Time at Pause

## Summary

At pause time, if the current Soniox connection has unfinalized (non-final) tokens, capture the `startMs` of the first unfinalized token as `pendingStartMs` and persist it across the connection handoff. This value is used by the main process to determine whether audio replay should include the unfinalized audio range.

## Details

When the user pauses:
1. Mic capture stops
2. An empty buffer is sent to finalize remaining tokens (async, non-blocking)
3. If there are still unfinalized tokens at this point, record `pendingStartMs` = `startMs` of the first unfinalized token (in session audio time, i.e., already offset by `connectionBaseMs`)
4. `pendingStartMs` is persisted so it's available at resume time

At resume, the main process combines `pendingStartMs` with the renderer's `replayStartMs`:
```ts
effectiveReplayStartMs =
  !eligible ? pendingStartMs ?? null
  : pendingStartMs == null ? replayStartMs
  : Math.min(replayStartMs!, pendingStartMs)
```

## Acceptance criteria

- [ ] At pause, if unfinalized tokens exist, `pendingStartMs` is captured (in session audio time)
- [ ] `pendingStartMs` survives across the pause period and is available at resume
- [ ] If no unfinalized tokens at pause, `pendingStartMs` is null
- [ ] Late-arriving final tokens during pause may clear/update the pending state appropriately
- [ ] Value is used in the effective replay start calculation at resume time

## References

- `spec/proposal-context-refresh.md` — "High-level flow" step 6, "What changes where" soniox-lifecycle section
