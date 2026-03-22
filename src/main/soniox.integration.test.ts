/**
 * Live Soniox API integration test.
 *
 * Connects to the real Soniox WebSocket endpoint, sends audio, and verifies
 * that the transcription pipeline completes end-to-end.
 *
 * Prerequisites:
 *   - A valid Soniox API key
 *   - Internet access
 *
 * Running:
 *   POSIX:       SONIOX_API_KEY=<key> npm run test:integration
 *   PowerShell:  $env:SONIOX_API_KEY="<key>"; npm run test:integration
 *
 * The test is excluded from the default `npm test` / `vitest run` command.
 * It skips gracefully (not fails) when SONIOX_API_KEY is not set.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { SonioxClient } from './soniox';
import { APP_SETTINGS_DEFAULTS } from './settings';
import type { AppSettings, SonioxToken } from '../shared/types';

const apiKey = process.env.SONIOX_API_KEY;
const suite = apiKey ? describe : describe.skip;

/** Generate 1 second of 16kHz 16-bit signed little-endian PCM (440Hz sine wave). */
function generatePcmAudio(): Buffer {
  const sampleRate = 16_000;
  const frequency = 440;
  const numSamples = sampleRate; // 1 second
  const buf = Buffer.alloc(numSamples * 2); // 16-bit = 2 bytes per sample

  for (let i = 0; i < numSamples; i++) {
    const sample = Math.round(0.5 * 32767 * Math.sin((2 * Math.PI * frequency * i) / sampleRate));
    buf.writeInt16LE(sample, i * 2);
  }

  return buf;
}

suite('SonioxClient (live integration)', () => {
  let client: SonioxClient;

  afterEach(() => {
    client?.disconnect();
  });

  it('connects, sends audio, and completes the transcription round-trip', async () => {
    const finalTokens: SonioxToken[] = [];
    let connected = false;
    let finishedReceived = false;
    let closeCode: number | undefined;
    let connectedResolve: () => void;
    let connectedReject: (err: Error) => void;
    let doneResolve: () => void;
    let doneReject: (err: Error) => void;

    const connectedPromise = new Promise<void>((resolve, reject) => {
      connectedResolve = resolve;
      connectedReject = reject;
    });

    // Resolves on either onFinished or a clean close (code 1000) after connect.
    const donePromise = new Promise<void>((resolve, reject) => {
      doneResolve = resolve;
      doneReject = reject;
    });

    client = new SonioxClient({
      onConnected: () => {
        connected = true;
        connectedResolve();
      },
      onFinalTokens: (tokens) => finalTokens.push(...tokens),
      onFinished: () => {
        finishedReceived = true;
        doneResolve();
      },
      onError: (err) => {
        connectedReject(err);
        doneReject(err);
      },
      onDisconnected: (code, reason) => {
        closeCode = code;
        if (!connected) {
          connectedReject(new Error(`Disconnected before connecting: code=${code} reason=${reason}`));
        }
        if (code === 1000) {
          // Normal close — treat as successful completion
          doneResolve();
        } else {
          doneReject(new Error(`Unexpected disconnect: code=${code} reason=${reason}`));
        }
      },
    });

    const settings: AppSettings = {
      ...APP_SETTINGS_DEFAULTS,
      sonioxApiKey: apiKey!,
    };

    client.connect(settings);
    await connectedPromise;
    expect(connected).toBe(true);

    // Send 1 second of PCM audio
    client.sendAudio(generatePcmAudio());

    // Signal end of audio stream
    client.finalize();

    // Wait for finished signal or clean close (test timeout is the backstop)
    await donePromise;

    // Verify round-trip completed via finished response or clean WebSocket close
    expect(finishedReceived || closeCode === 1000).toBe(true);

    // If Soniox returned final tokens, verify they have non-empty text
    for (const token of finalTokens) {
      expect(token.text.trim()).not.toBe('');
    }
  });
});
