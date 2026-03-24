# Replace naudiodon/PortAudio audio capture with Chromium getUserMedia

## Summary
The current audio capture uses naudiodon (PortAudio) in the main process. PortAudio fails with Bluetooth headsets (e.g. Jabra Evolve2 65) — audio chunks arrive seconds late and contain near-silence, producing zero transcription from Soniox. Other apps (including Vowen, which uses SDL2, and browser-based meeting apps) handle the same Bluetooth device fine because they use native Windows audio APIs.

Electron's Chromium renderer has full support for `navigator.mediaDevices.getUserMedia()` which uses native WASAPI on Windows and handles Bluetooth devices correctly. Replace the naudiodon-based capture with a renderer-side AudioWorklet that captures PCM and sends chunks to the main process via IPC.

## Acceptance criteria
- Audio capture uses `getUserMedia` + AudioWorklet in the renderer process instead of naudiodon in main.
- PCM chunks (16kHz, 16-bit, mono) are sent from renderer to main via IPC and forwarded to the Soniox WebSocket.
- Bluetooth headsets (Jabra Evolve2 65) produce valid audio that Soniox can transcribe.
- Device selection still works — the user can pick a specific input device in settings.
- Volume meter still functions (dB computed from PCM chunks).
- Latency is acceptable for real-time transcription (no perceptible delay vs current implementation).
- The "Test Microphone" feature in settings still works.
- All existing tests pass or are updated to reflect the new capture path.

## Approach
1. Create an AudioWorklet processor in the renderer that captures mic audio via `getUserMedia({ audio: { deviceId, sampleRate: 16000, channelCount: 1 } })`.
2. The worklet resamples/converts to 16-bit PCM and posts chunks to the renderer main thread.
3. The renderer sends chunks to main via IPC (`ipcRenderer.send`).
4. Main process receives chunks and forwards to `soniox.sendAudio()` and computes dB for the volume meter.
5. Remove naudiodon dependency once migration is verified.

## References
- Current capture: `src/main/audio.ts` (naudiodon/PortAudio)
- Soniox lifecycle: `src/main/soniox-lifecycle.ts` (onAudioData)
- Investigation: Jabra Evolve2 65 Bluetooth headset delivers ~1 chunk per 3 seconds via PortAudio, with firstSamples=[0,0,-1,0]. Same device works in Vowen (SDL2) and browser apps (getUserMedia).
- Vowen reference: `C:\Users\oliver.chambers\AppData\Local\Programs\Vowen` uses audio-recorder.exe + SDL2.dll
