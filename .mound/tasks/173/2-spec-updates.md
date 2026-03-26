# Spec Updates

## Spec changes required

### `spec/proposal-context-refresh.md` — Replay completion section (line ~227)

**What needs to change:** The current spec describes the drain detection heuristic and the 10-second safety timeout, but does not mention the zero-token edge case or a shorter timeout for silence-only replay audio.

**Proposed change:** Add a sentence to the replay completion paragraph clarifying the zero-token fast path:

> If no final tokens are received within 3 seconds of entering the drain phase, the replay is considered complete immediately — this handles the case where replay audio contains only silence and Soniox produces no tokens. The 10-second safety timeout remains as the ultimate fallback for cases where tokens are received but the drain heuristic doesn't converge.

**Why:** The spec should document this behavior so future readers understand the two-tier timeout strategy (3s zero-token + 10s safety).

## New spec content

None required.
