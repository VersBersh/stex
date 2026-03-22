# Plan

## Goal

Add an opt-in integration test that verifies the Soniox transcription pipeline works end-to-end against the real API.

## Steps

### 1. Update `vitest.config.ts` to exclude integration tests from default run

Modify the existing vitest config to explicitly exclude `**/*.integration.test.ts` from the default `include` pattern:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['**/*.integration.test.ts'],
  },
});
```

This ensures `vitest run` (the `npm test` command) never picks up integration tests, satisfying the "excluded from default npm test" acceptance criterion.

### 2. Add `test:integration` script to `package.json`

Add to the `scripts` section:
```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

### 3. Create `vitest.integration.config.ts`

Create a separate vitest config for integration tests:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 30_000,
  },
});
```

This keeps integration config isolated from unit tests and allows a longer timeout for network operations.

### 4. Create `src/main/soniox.integration.test.ts`

Create the integration test file with:

**Header comment** documenting:
- Purpose: live Soniox API integration test
- How to run: `SONIOX_API_KEY=<key> npm run test:integration` (POSIX) or `$env:SONIOX_API_KEY="<key>"; npm run test:integration` (PowerShell)
- Prerequisites: valid Soniox API key

**Skip guard**: Use conditional describe at the module level:
```ts
const apiKey = process.env.SONIOX_API_KEY;
const suite = apiKey ? describe : describe.skip;
```
This ensures tests skip gracefully (not fail) when no API key is set.

**Test: "connects, sends audio, and receives transcription tokens"**:
1. Create a `SonioxClient` with event callbacks that collect final tokens and track connection/finish events.
2. Build settings using `APP_SETTINGS_DEFAULTS` with `sonioxApiKey` set from `process.env.SONIOX_API_KEY`.
3. Call `client.connect(settings)` and wait for `onConnected` via a Promise.
4. Generate a short PCM audio buffer — 1 second of 16kHz 16-bit sine wave at 440Hz. While not speech, this verifies the full round-trip: WebSocket connect, config handshake, audio upload, and response parsing.
5. Send the audio via `client.sendAudio()`.
6. Call `client.finalize()` to signal end of stream.
7. Wait for `onFinished` callback (via a Promise, with vitest's 30s test timeout as the backstop).
8. Assert: the connection was established, audio was sent, and the `finished` signal was received. Also verify that if any final tokens were received, they have non-empty `text` fields. (A pure tone may or may not produce transcribed text, but the round-trip must complete.)
9. Call `client.disconnect()` in `afterEach` to ensure cleanup on failure.

**Test: "receives final tokens with non-empty text from speech-like audio"** (optional hardening):
- This test is aspirational — if Soniox does return tokens for the tone, we verify `text` is non-empty. We won't fail if no final tokens arrive (since the input isn't speech), but we DO verify the pipeline doesn't error.

### 5. Logger behavior

The `SonioxClient` imports from `./logger`. Since `initLogger()` won't have been called, `logFile` will be `null` and logging falls back to `console.log`/`console.error`, which is fine for debugging integration test output. No mocking needed.

## Risks / Open Questions

- **Audio content**: A 440Hz sine wave is not speech, so Soniox may not return final tokens with text. The primary assertion is that the full round-trip completes (`connected` -> `audio sent` -> `finished`). If final tokens are present, we verify their `text` is non-empty. This approach avoids flaky tests while still proving the pipeline works.
- **Network dependency**: Test requires internet access and a valid API key. Designed to be opt-in only via `SONIOX_API_KEY` env var.
- **Cost**: ~1 second of audio per run. Acceptable for an opt-in test.
- **Spec drift in `spec/api.md`**: The review identified that `spec/api.md` has stale endpoint URLs and field names that don't match the implementation. This is a pre-existing issue outside the scope of this task and should be addressed in a separate task.
