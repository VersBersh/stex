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

## 7. Manual WebSocket over @soniox/node SDK for Soniox Integration

**Decision**: Keep the manual WebSocket implementation in `src/main/soniox.ts` (see Decision 3) rather than migrating to the official `@soniox/node` SDK.

**Rationale**: The `@soniox/node` SDK (v1.1.2, published Feb 2026) was evaluated based on its published npm registry data and documentation at soniox.com/docs. The SDK appears technically compatible with our audio pipeline — published docs indicate support for `pcm_s16le`, configurable sample rate/channels, `language_hints`, and `max_endpoint_delay_ms`. It has no native dependencies (~815 KB unpacked), making it Electron-compatible.

However, migration is not recommended at this time for the following reasons:

1. **Error classification dependency**: `classifyDisconnect()` in `error-classification.ts` relies on raw WebSocket close codes (1000, 1001, 1006, 1008, 1011) and reason strings to determine reconnectable vs terminal disconnects. The SDK abstracts away these transport-level details. Adapting our reconnection logic would require rewriting `classifyDisconnect()` and `handleDisconnect()` in `soniox-lifecycle.ts`, with risk of subtle reconnection behavior changes.

2. **Token deduplication uncertainty**: Our `lastFinalProcMs` watermark in `soniox.ts` depends on the `final_audio_proc_ms` field in the raw WebSocket response. Whether the SDK's result events preserve this field with identical semantics is not confirmed by the available documentation and would require integration testing to verify.

3. **SDK maturity**: At ~1 month old (v1.1.2), the SDK has limited production track record. Waiting for it to stabilize is prudent for a production Electron app.

4. **Low benefit-to-risk ratio**: The current implementation is ~120 lines with 21 passing tests. The SDK's main benefits (endpoint URL management, protocol versioning, keepalive) address risks that haven't materialized.

**Alternatives considered**:
- **Full migration**: Replace `SonioxClient` with an SDK-backed wrapper. Rejected due to error classification and dedup concerns above.
- **Hybrid approach**: Use SDK for connection/auth, manual handling for responses. Rejected as it would add the SDK dependency without eliminating our custom code.

**Revisit when**:
- The SDK reaches v2.x or has 6+ months of production usage
- Soniox changes their WebSocket protocol in a breaking way
- Error classification is refactored to not depend on raw close codes

**Re-evaluation log**:
- **2026-03-23** — Re-evaluated (task 105). Checked npm registry: SDK still at v1.1.2 (4 releases between Feb 9–24, 2026; no releases since). No v2.x. Only ~1.5 months since initial publish, well short of the 6-month production usage threshold. Checked codebase: `classifyDisconnect()` in `error-classification.ts` still switches on raw WebSocket close codes (1000, 1001, 1006, 1008, 1011); `lastFinalProcMs` watermark in `soniox.ts` still depends on raw `final_audio_proc_ms` field; implementation remains ~156 lines with 21 passing tests (low benefit-to-risk unchanged). No WebSocket protocol breaking change observed (existing endpoint `wss://stt-rt.soniox.com/transcribe-websocket` still in use). All four original concerns remain valid; none of the three revisit triggers are met. **Decision: Defer. Next re-evaluation ~Sep 2026.**
