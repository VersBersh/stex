# Spec Updates (Revised)

## Spec changes required

### `spec/architecture.md`

1. **High-Level Overview diagram** (lines 5-62): Update the "Audio Capture" box under Main Process to reflect its new role as an IPC relay (receives chunks from renderer, forwards to Soniox). Add a new "Audio Capture" box under the Renderer (Overlay) section showing getUserMedia + AudioWorklet.

2. **Main Process responsibilities table — Audio Capture row** (line 74): Change from "Opens the microphone via naudiodon (PortAudio bindings)..." to describe the new IPC relay role: receives PCM chunks from renderer via IPC, forwards to Soniox Client. Manages start/stop commands to renderer. No native audio dependencies.

3. **Renderer Process (Overlay) responsibilities table** (lines 80-84): Add a new row for **Audio Capture** — uses `getUserMedia` + `AudioWorklet` to capture mic audio as PCM s16le 16kHz mono. Sends chunks to main process via IPC. Handles device selection by matching device name from settings to browser-enumerated devices.

4. **Renderer Process (Settings) responsibilities table** (lines 88-91): Update Settings UI row to note that audio input device enumeration is done directly in the renderer via `navigator.mediaDevices.enumerateDevices()` rather than via main-process IPC.

5. **Data Flow diagram** (lines 95-112): Replace the flow to show:
   ```
   Microphone
       |
       v
   getUserMedia + AudioWorklet (Renderer/Overlay Process)
       |  PCM s16le 16kHz mono (ArrayBuffer via IPC)
       v
   Audio Relay (Main Process)
       |  Buffer chunks
       v
   Soniox WebSocket Client (Main Process)
   ```

6. **IPC Messages table** (lines 114-141):
   - Add: `audio:start-capture` (Main → Renderer) — Signal renderer to start getUserMedia capture with device name
   - Add: `audio:stop-capture` (Main → Renderer) — Signal renderer to stop capture and clean up resources
   - Add: `audio:chunk` (Renderer → Main) — PCM audio chunk (Buffer) from renderer AudioWorklet
   - Add: `audio:capture-error` (Renderer → Main) — Normalized audio capture error from renderer
   - Update: `audio:get-devices` — Note this is now handled directly in the settings renderer preload via `navigator.mediaDevices.enumerateDevices()`, no longer routed through main process

7. **File Structure section** (lines 143-185):
   - Add `audio-capture.ts` under `renderer/overlay/` with description "Audio capture via getUserMedia + AudioWorklet"
   - Update `audio.ts` under `main/` description from "Audio Capture (naudiodon / PortAudio)" to "Audio IPC relay (receives chunks from renderer)"

8. **Technology Stack table** (lines 189-197): Change "Audio capture" row from "naudiodon (PortAudio) in main process" to "getUserMedia + AudioWorklet in renderer process"

## New spec content

No new spec files needed. All changes are updates to `spec/architecture.md`.
