# Plan

## Goal

Document the evaluation of migrating `src/main/soniox.ts` from manual WebSocket to the `@soniox/node` SDK, concluding that migration is deferred due to error classification dependencies, SDK maturity, and low benefit-to-risk ratio.

## Steps

### Step 1: Add decision entry to `spec/decisions.md`

**File:** `spec/decisions.md`

Append a new decision entry (## 7) after the existing entries, using the same format as existing decisions (Decision / Rationale / Alternatives considered). Cross-reference Decision #3 since both concern the Soniox integration approach.

Frame SDK details as findings from published documentation (npm registry, soniox.com/docs) rather than repo-verified facts, since `@soniox/node` is not installed in this repo.

Decision text:

```markdown
## 7. Manual WebSocket over @soniox/node SDK for Soniox Integration

**Decision**: Keep the manual WebSocket implementation in `src/main/soniox.ts` (see Decision 3) rather than migrating to the official `@soniox/node` SDK.

**Rationale**: The `@soniox/node` SDK (v1.1.2, published Feb 2026) was evaluated based on its published npm registry data and documentation at soniox.com/docs. The SDK appears technically compatible with our audio pipeline — published docs indicate support for `pcm_s16le`, configurable sample rate/channels, `language_hints`, and `max_endpoint_delay_ms`. It has no native dependencies (~815 KB unpacked), making it Electron-compatible.

However, migration is not recommended at this time for the following reasons:

1. **Error classification dependency**: `classifyDisconnect()` in `error-classification.ts` relies on raw WebSocket close codes (1000, 1001, 1006, 1008, 1011) and reason strings to determine reconnectable vs terminal disconnects. The SDK abstracts away these transport-level details. Adapting our reconnection logic would require rewriting `classifyDisconnect()` and `handleDisconnect()` in `soniox-lifecycle.ts`, with risk of subtle reconnection behavior changes.

2. **Token deduplication uncertainty**: Our `lastFinalProcMs` watermark in `soniox.ts` depends on the `final_audio_proc_ms` field in the raw WebSocket response. Whether the SDK's result events preserve this field with identical semantics is not confirmed by the available documentation and would require integration testing to verify.

3. **SDK maturity**: At ~1 month old (v1.1.2), the SDK has limited production track record. Waiting for it to stabilize is prudent for a production Electron app.

4. **Low benefit-to-risk ratio**: The current implementation is ~120 lines with 21 passing tests. The SDK's main benefits (endpoint URL management, protocol versioning, keepalive) address risks that haven't materialized.

**Alternatives considered**:
- **Full migration**: Replace `SonioxClient` with an SDK-backed wrapper. Rejected due to error classification and dedup concerns above.
- **Hybrid approach**: Use SDK for connection/auth, manual handling for responses. Rejected as it would add the SDK dependency without eliminating our custom code.

**Revisit when**:
- The SDK reaches v2.x or has 6+ months of production usage
- Soniox changes their WebSocket protocol in a breaking way
- Error classification is refactored to not depend on raw close codes
```

### Step 2: Verify existing tests still pass

**Action:** Run `npx vitest run src/main/soniox.test.ts` to confirm the existing soniox tests pass (no code changes were made to `soniox.ts`). If the test runner fails due to environment limitations (e.g., sandbox restrictions), note the limitation rather than asserting pass status.

## Risks / Open Questions

1. **SDK may already expose close codes**: The SDK's `disconnected` event handler signature is not fully documented in the pages we accessed. If it provides close codes, the error classification concern weakens. The uncertainty itself supports deferring.

2. **Spec drift**: The reviewer noted that `spec/api.md` documents a different endpoint (`wss://stt.soniox.com/transcribe`) than `soniox.ts` uses (`wss://stt-rt.soniox.com/transcribe-websocket`), and `spec/models.md` is missing some `SessionState` status values. These spec inconsistencies are pre-existing and out of scope for this evaluation task. Noted in `4-impl-notes.md` as discovered work.

3. **Other tasks may reference SDK migration**: Tasks 92 and 93 descriptions should be checked for SDK assumptions.
