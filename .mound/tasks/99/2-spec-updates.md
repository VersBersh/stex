# Spec Updates

## Spec changes required

### `spec/api.md` — Client-Side Processing section

**What needs to change:** The pseudocode in the "Client-Side Processing" section (lines 89-118) describes parsing the response and separating final/non-final tokens, but does not mention filtering protocol markers. Add a step between "Parse response" and "Separate final tokens" to filter out endpoint detection markers (`<end>` tokens) before further processing.

**Why:** The `<end>` token is a transport-level marker from Soniox's endpoint detection feature (`enable_endpoint_detection: true`). The spec should document that these markers are stripped at the Soniox client boundary so downstream consumers only receive content tokens.

### Specs not requiring changes

- **`spec/architecture.md`** — Describes the Soniox Client as "Receives token responses, separates final/non-final, and forwards to renderer via IPC". This remains accurate at the architectural summary level — filtering protocol markers is an internal implementation detail of the token separation step.
- **`spec/features/realtime-transcription.md`** — States "Silence: Soniox endpoint detection fires after a pause, finalizing the current utterance. No special handling needed." This refers to application-level behavior (the utterance finalizes naturally), not to protocol-level token processing. No change needed.
- **`spec/models.md`** — `SonioxToken` type matches the Soniox API shape. The filtering happens before tokens are dispatched to callbacks, so downstream code never sees protocol markers. The type definition remains accurate.

## New spec content

None required.
