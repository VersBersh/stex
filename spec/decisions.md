# Technical Decisions

## 1. Electron for the Desktop Shell

**Decision**: Use Electron as the desktop application framework.

**Rationale**: The app runs persistently in the system tray, so Electron's cold-start cost (~2-3s) is paid once at login. Window show/hide is instant (<50ms). Electron gives us access to the full web ecosystem for the editor UI, system tray APIs, global hotkey registration, and clipboard access.

**Alternatives considered**:
- **WPF**: Faster cold start, but limited editor ecosystem. Would require WebView2 to get a good editor anyway.
- **Tauri**: Faster and lighter than Electron, but less mature ecosystem and more complex audio handling.
- **WPF + WebView2**: Viable hybrid, but adds complexity of bridging C# and web without significant benefit since the app is tray-resident anyway.

## 2. Lexical for the Text Editor

**Decision**: Use Meta's Lexical editor framework for the transcription/editing surface.

**Rationale**: Lexical is purpose-built for rich text editing with a clean plugin architecture. We need custom behavior — ghost text rendering, preventing overwrites of user edits, cursor management during streaming — and Lexical's node/decorator system makes this straightforward. It's also lightweight and fast.

**Alternatives considered**:
- **ProseMirror**: More mature but heavier API surface for what we need.
- **CodeMirror**: Optimized for code, not prose.
- **ContentEditable directly**: Too low-level; we'd be reimplementing an editor.

## 3. Soniox WebSocket API for Speech-to-Text

**Decision**: Use Soniox's real-time WebSocket API for streaming transcription.

**Rationale**: Soniox provides low-latency streaming with clear final/non-final token semantics, which maps directly to our ghost-text-then-commit editing model. Configurable endpoint detection (500ms–3000ms) lets us tune responsiveness. Supports 60+ languages.

**Key behaviors we depend on**:
- Non-final tokens update in place (ghost text)
- Final tokens never change (committed text)
- `max_endpoint_delay_ms` controls how fast utterances finalize

## 4. System Tray with Show/Hide Pattern

**Decision**: Run as a tray-resident app that shows/hides a pre-created window via global hotkey.

**Rationale**: This gives instant window activation since the window and editor are already initialized in memory. The user never waits for startup. This is the same pattern used by apps like Spotlight, Raycast, and clipboard managers.

## 5. Native Audio Capture in Main Process

**Decision**: Capture microphone audio in the Electron main process using a native Node.js addon (`naudiodon` / PortAudio bindings) rather than the Web Audio API in the renderer.

**Rationale**: Native audio capture gives better quality, lower latency, and more control over the audio pipeline. The Soniox WebSocket client also lives in the main process alongside audio capture, keeping the entire audio-to-transcription pipeline in one process. The renderer becomes a pure display layer — it receives token events via IPC and renders them in Lexical.

**Alternatives considered**:
- **Web Audio API in renderer**: Simpler setup, no native deps, but higher latency and less control. Audio and WebSocket would both be in the renderer, coupling the UI process to the audio pipeline.

**Fallback plan**: If `naudiodon` proves too unreliable (build issues, device compatibility problems, packaging friction with electron-builder), fall back to the Web Audio API in the renderer. This is a viable backup that trades latency and control for simplicity. Validate the naudiodon + Electron + electron-builder pipeline early in development before investing in features.

## 6. Settings and History in a Separate Window

**Decision**: Settings, API key management, and transcription history are accessed via a separate Electron BrowserWindow, opened from the system tray menu — not embedded in the transcription overlay.

**Rationale**: The transcription overlay must stay minimal and focused. Settings and history are infrequent operations that deserve proper UI space. Using a second window within the same Electron app keeps things simple (shared process, shared settings store) without bloating the overlay.
