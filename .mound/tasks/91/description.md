# Evaluate migrating Soniox integration to official @soniox/node SDK

## Summary

The current Soniox integration (`src/main/soniox.ts`) manually manages the WebSocket connection, authentication, config messages, and response parsing against the Soniox real-time STT API. The official `@soniox/node` SDK (v1.1.2+, published Feb 2026) handles endpoint URLs, protocol versioning, auth, and response parsing automatically.

Evaluate whether migrating to the SDK is worthwhile. If a prior decision was made to avoid the SDK (e.g., for bundle size, Electron compatibility, or fine-grained control over reconnection logic), document that rationale in `spec/decisions.md` and skip the migration.

## Acceptance criteria

- [ ] Investigate `@soniox/node` SDK: API surface, bundle size impact, Electron/Node ABI compatibility, and whether it supports raw PCM streaming with the same config options currently used (sample rate, channels, language hints, endpoint delay)
- [ ] If migration is viable: replace the manual WebSocket code in `src/main/soniox.ts` with SDK calls, update tests, and verify the app works end-to-end
- [ ] If migration is not viable: document the decision and reasoning in `spec/decisions.md` under a new entry
- [ ] All existing `soniox.test.ts` tests pass (adapted to the new integration if migrated)

## References

- `src/main/soniox.ts` — current manual WebSocket implementation
- `src/main/soniox.test.ts` — existing test suite (21 tests)
- `@soniox/node` on npm: https://www.npmjs.com/package/@soniox/node
- SDK docs: https://soniox.com/docs/stt/SDKs/node-SDK
- `spec/decisions.md` — architecture decision log
