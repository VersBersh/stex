# Plan — Task 79

## Goal

Rewrite `classifyDisconnect` to use the WebSocket close code as the primary classification signal, falling back to reason text for ambiguous or application-defined codes.

## Steps

### 1. Rewrite `classifyDisconnect` in `src/main/error-classification.ts`

Replace the current reason-only logic with a two-tier approach:

```typescript
export function classifyDisconnect(code: number, reason: string): { reconnectable: boolean; error: ErrorInfo } {
  // Tier 1: Standard WebSocket close codes (RFC 6455)
  switch (code) {
    case 1000: // Normal closure — server-initiated clean close (user-initiated doesn't reach here)
    case 1001: // Going away (server shutting down)
    case 1006: // Abnormal closure (no close frame — network issue)
    case 1011: // Internal server error
      return { reconnectable: true, error: { type: 'network', message: 'Connection lost' } };
  }

  // Tier 2: Application-defined codes (4000-4999) and unrecognized codes — use reason text
  const reasonLower = reason.toLowerCase();

  if (reasonLower.includes('api key') || reasonLower.includes('unauthorized') || reasonLower.includes('authentication')) {
    return {
      reconnectable: false,
      error: {
        type: 'api-key',
        message: 'Invalid API key',
        action: { label: 'Open Settings', action: 'open-settings' },
      },
    };
  }

  if (reasonLower.includes('rate limit') || reasonLower.includes('quota') || reasonLower.includes('too many')) {
    return {
      reconnectable: false,
      error: {
        type: 'rate-limit',
        message: 'Rate limit exceeded',
      },
    };
  }

  // Default: assume reconnectable network issue
  return { reconnectable: true, error: { type: 'network', message: 'Connection lost' } };
}
```

**Key design decisions:**
- `1000` (normal closure): reconnectable. User-initiated stops call `soniox.disconnect()` which removes listeners before closing — so `1000` only reaches `handleDisconnect` for server-initiated clean closes, which are transient. This aligns with spec (api.md:124 says WebSocket disconnects auto-reconnect).
- `1001` (going away): reconnectable — server restarting/shutting down, transient.
- `1006` (abnormal): reconnectable — network failure, no close frame received.
- `1011` (internal error): reconnectable — server-side transient error.
- `1008` (policy violation): falls through to reason text analysis. The code alone is too generic to assume auth failure — the reason text provides the specificity needed.
- `4000-4999` and unrecognized codes: fall through to reason text analysis (existing logic preserved).

### 2. Update tests in `src/main/error-classification.test.ts`

Restructure the `classifyDisconnect` describe block to cover:

**Code-based classification tests (new):**
- `1000` → reconnectable, network type
- `1001` → reconnectable, network type
- `1006` → reconnectable, network type (existing test stays, now hits code path directly)
- `1011` → reconnectable, network type

**Code-based with reason text ignored (new):**
- `1006` with auth-like reason text → still reconnectable (code takes precedence)

**Reason-text fallback tests (updated from existing):**
- Application code (e.g. `4001`) + auth reason → api-key (existing tests, still pass via reason text)
- Application code (e.g. `4029`) + rate limit reason → rate-limit (existing tests, still pass via reason text)
- Application code (e.g. `4000`) + generic reason → reconnectable network
- Application code + empty reason → reconnectable network
- `1008` + auth reason → api-key (reason text fallback for ambiguous standard code)
- `1008` + generic reason → reconnectable network (no false positive on api-key)

### 3. No changes to callers

`session.ts` already passes `(code, reason)` to `classifyDisconnect` at line 176. The return type is unchanged. No caller modifications needed.

## Risks / Open Questions

1. **Soniox-specific close codes are unknown.** We don't know the exact application-defined codes Soniox uses. The reason text fallback for 4000-4999 preserves existing behavior for these cases.
2. **`1000` from server is assumed transient.** If the server sends `1000` to indicate a permanent "you're done" condition, we'd incorrectly reconnect. This seems unlikely — the Soniox spec says streams can be up to 300 minutes, and clean closes from the server during active streaming are most likely connection management, not intentional termination.
3. **No new ErrorInfo types.** There's no `'server-error'` or `'closed'` type. We reuse `'network'` for all connection-related issues, consistent with current design.
4. **Review issue about session-level tests (Minor).** The existing `session-reconnect.test.ts` already tests reconnectable vs terminal paths using codes 1006 and 4001. Since those tests pass through the real `classifyDisconnect`, they will implicitly validate the new code-based paths. Adding explicit session-level tests for new code paths (1000, 1001, 1011) is deferred — the unit tests in `error-classification.test.ts` are sufficient for this change.
