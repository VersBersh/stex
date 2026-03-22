# Add live Soniox integration test

## Summary

There is no way to verify that the Soniox connection and transcription pipeline actually works end-to-end without manually running the app. Add an integration test that connects to the real Soniox API, sends audio, and verifies that transcription tokens come back. This test should only run when explicitly invoked (not as part of `npm test`) since it requires a valid API key and incurs cost.

## Acceptance criteria

- [ ] Create an integration test file (e.g., `src/main/soniox.integration.test.ts`) that:
  - Connects to the Soniox WebSocket endpoint using a real API key
  - Sends a short audio clip (a bundled PCM fixture or synthesized audio)
  - Verifies that final tokens are received with non-empty text
  - Disconnects cleanly
- [ ] The test is excluded from the default `npm test` / `vitest run` — it should only run via an explicit command (e.g., `npm run test:integration` or `npx vitest run --project integration`)
- [ ] The test reads the API key from the `SONIOX_API_KEY` environment variable
- [ ] The test skips gracefully (not fails) if `SONIOX_API_KEY` is not set
- [ ] Add a `test:integration` script to `package.json`
- [ ] Document how to run the integration test in the test file header or README

## References

- `src/main/soniox.ts` — `SonioxClient` class to test against
- `src/main/soniox.test.ts` — existing unit tests (mocked WebSocket)
- Task 92 — logging (useful for debugging integration test failures)
