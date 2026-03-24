# Architecture

## High-Level Overview

```
+-------------------------------------------------------------------+
|                        Electron Main Process                       |
|                                                                    |
|  +------------------+  +------------------+  +------------------+  |
|  |  Tray Manager    |  |  Window Manager  |  |  Settings Store  |  |
|  |                  |  |                  |  |                  |  |
|  |  - System tray   |  |  - Overlay win   |  |  - Load/save     |  |
|  |    icon & menu   |  |    (show/hide)   |  |    preferences   |  |
|  |  - Context menu  |  |  - Settings win  |  |  - API key       |  |
|  |                  |  |  - Position      |  |    management    |  |
|  |                  |  |    persistence   |  |                  |  |
|  +------------------+  +------------------+  +------------------+  |
|                                                                    |
|  +------------------+  +------------------+  +------------------+  |
|  |  Hotkey Manager  |  |  Audio Relay     |  |  Soniox Client   |  |
|  |                  |  |                  |  |                  |  |
|  |  - Register      |  |  - Receives PCM  |  |  - WebSocket     |  |
|  |    global hotkey |  |    from renderer |  |    connection    |  |
|  |  - Toggle via    |  |    via IPC       |  |  - Send audio    |  |
|  |    Session Mgr   |  |  - Forwards to   |  |  - Receive       |  |
|  |                  |  |    Soniox client |  |    tokens        |  |
|  |                  |  |  - Sends start/  |  |  - Track final   |  |
|  |                  |  |    stop commands |  |    vs non-final  |  |
|  +------------------+  +------------------+  +------------------+  |
|                                                                    |
|  +------------------+                                              |
|  |  Session Manager |                                              |
|  |                  |                                              |
|  |  - Orchestrates start/stop/pause                                |
|  |  - Manages state transitions                                    |
|  |  - Forwards tokens to renderer via IPC                          |
|  +------------------+                                              |
+-------------------------------------------------------------------+
        |                          IPC                          |
        v                     (tokens, state)                   v
+-------------------------------------------------------------------+
|                   Renderer Process (Overlay Window)                 |
|                                                                    |
|  +------------------+  +------------------+  +------------------+  |
|  |  Lexical Editor  |  |  Ghost Text      |  |  Status Bar      |  |
|  |                  |  |  Plugin          |  |                  |  |
|  |  - Text editing  |  |  - Render non-   |  |  - Mic state     |  |
|  |  - Block         |  |    final tokens  |  |  - Pause/resume  |  |
|  |    management    |  |  - Update in     |  |  - Clear / Copy  |  |
|  |  - Cursor        |  |    place         |  |                  |  |
|  |    preservation  |  |                  |  |                  |  |
|  +------------------+  +------------------+  +------------------+  |
+-------------------------------------------------------------------+
+-------------------------------------------------------------------+
|                   Renderer Process (Settings Window)                |
|                                                                    |
|  - API key configuration                                           |
|  - Hotkey customization                                            |
|  - Preferences (theme, behavior)                                   |
|  - Transcription history (future)                                  |
+-------------------------------------------------------------------+
```

## Component Responsibilities

### Main Process

| Component | Responsibility |
|-----------|---------------|
| **Tray Manager** | Creates the system tray icon, handles right-click context menu (Show/Hide, Settings, Quit) |
| **Window Manager** | Creates two BrowserWindows: the overlay (frameless, always-on-top, no taskbar) and the settings window. Handles show/hide, persists overlay position/size. Each window has exactly one preload script: the overlay loads `src/preload/index.ts` (exposes `window.api`), the settings window loads `src/preload/settings-preload.ts` (exposes `window.settingsApi`) |
| **Hotkey Manager** | Registers the global hotkey via `globalShortcut`, triggers session toggle via Session Manager |
| **Settings Store** | Reads/writes `settings.json` using `electron-store` or similar. Exposes settings to both renderers via IPC. `getSettings()` returns *effective* settings: for `sonioxApiKey`, the store applies resolution precedence (non-empty saved value > `SONIOX_API_KEY` env var > empty string) — the resolved value is never written back to disk. The `sonioxApiKey` is encrypted at rest via `safeStorage`. Renderer-facing IPC returns a masked display value for `sonioxApiKey`; only main-process `getSettings()` returns the decrypted effective key. Includes `silenceThresholdDb` (number, default -30) for configurable silence threshold consumed by future VAD logic |
| **Audio Relay** | Receives PCM s16le 16kHz mono chunks from the overlay renderer via IPC (`audio:chunk`). Forwards chunks to the Soniox Client and computes audio levels for the volume meter. Sends `audio:start-capture` / `audio:stop-capture` commands to the renderer to control capture lifecycle. If the renderer reports a capture error, stops capture and shows an error — user must resume manually. |
| **Soniox Client** | Manages WebSocket connection to Soniox. Receives audio from Audio Capture, sends it as binary frames. Receives token responses, separates final/non-final, and forwards to renderer via IPC |
| **Session Manager** | Orchestrates the lifecycle: on "start" → init audio + connect WebSocket; on "stop" → close audio + send empty frame for finalization + wait for response; on "pause" → stop mic capture, send empty frame, wait for finalization, keep WS alive; on "resume" → restart mic capture. Manages state transitions and notifies renderer. On WebSocket disconnect, classifies the error and either auto-reconnects with exponential backoff (1s, 2s, 4s, max 30s) or surfaces a non-reconnectable error (API key, rate limit). After successful reconnect, waits for user to resume manually |

### Renderer Process (Overlay)

| Component | Responsibility |
|-----------|---------------|
| **Lexical Editor** | The user-facing text surface. Custom plugins handle: appending committed text from final tokens, rendering ghost text from non-final tokens, preserving cursor position during updates |
| **Audio Capture** | Captures microphone audio via `getUserMedia` + `AudioWorklet` in the renderer process. Produces PCM s16le 16kHz mono chunks and sends them to the main process via IPC (`audio:chunk`). Handles device selection by matching device name from settings to browser-enumerated devices. Responds to `audio:start-capture` / `audio:stop-capture` IPC commands from main. |
| **Ghost Text Plugin** | Lexical plugin that renders non-final tokens as read-only, styled (muted italic) text at the document tail. Replaces on each update |
| **Status Bar** | Displays recording state, pause/resume button, clear and copy actions |

### Renderer Process (Settings)

| Component | Responsibility |
|-----------|---------------|
| **Settings UI** | Form-based UI for API key, hotkey config, audio input device selection, theme, behavior preferences. Reads/writes via IPC to Settings Store. Audio device enumeration is performed directly in the renderer via `navigator.mediaDevices.enumerateDevices()` |
| **History UI** | (Future) Browse and search past transcription sessions |

## Data Flow

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
    |  binary frames out, JSON tokens in
    v
Session Manager (Main Process)
    |
    +---> IPC: final tokens ---------> Renderer: Lexical append EditorBlock
    |
    +---> IPC: non-final tokens -----> Renderer: Lexical update GhostText
    |
    +---> IPC: status changes -------> Renderer: StatusBar update
```

## IPC Messages

| Direction | Channel | Payload | Purpose |
|-----------|---------|---------|---------|
| Main → Renderer | `session:start` | `onShow: 'fresh' \| 'append'` | Signal session started. Renderer clears editor if onShow is 'fresh'. |
| Main → Renderer | `session:stop` | — | Signal session ended |
| Main → Renderer | `session:paused` | — | Signal recording paused |
| Main → Renderer | `session:resumed` | — | Signal recording resumed |
| Main → Renderer | `tokens:final` | `SonioxToken[]` | New finalized tokens to commit to editor |
| Main → Renderer | `tokens:nonfinal` | `SonioxToken[]` | Current non-final tokens (replaces previous ghost text) |
| Main → Renderer | `session:status` | `SessionState.status` | Status changes: `idle`, `connecting`, `recording`, `paused`, `finalizing`, `error`, `reconnecting` |
| Main → Renderer | `session:text` | — | Request editor text for clipboard copy |
| Renderer → Main | `session:text` | `string` | Respond with editor text for clipboard copy |
| Renderer → Main | `session:request-pause` | — | User clicked pause button |
| Renderer → Main | `session:request-resume` | — | User clicked resume button |
| Renderer → Main | `window:hide` | — | Request overlay dismiss — routes through Session Manager for finalization before hiding (title bar close button) |
| Renderer → Main | `window:escape-hide` | — | Quick dismiss — stops session without finalization or clipboard, hides immediately (Escape key) |
| Renderer → Main | `settings:get` | — | Request current settings |
| Renderer → Main | `settings:set` | `key: string, value: unknown` | Update a single setting |
| Main → Renderer | `audio:start-capture` | `deviceName: string \| null` | Signal renderer to start getUserMedia capture with specified device |
| Main → Renderer | `audio:stop-capture` | — | Signal renderer to stop capture and clean up resources |
| Renderer → Main | `audio:chunk` | `Buffer` | PCM s16le 16kHz mono audio chunk from renderer AudioWorklet |
| Renderer → Main | `audio:capture-error` | `string` | Normalized audio capture error message from renderer |
| Main → Renderer | `settings:updated` | `AppSettings` | Push settings changes |
| Main → Renderer | `session:error` | `ErrorInfo \| null` | Push error details for error banner display; `null` clears the current error (recovery) |
| Renderer → Main | `session:open-settings` | — | User clicked "Open Settings" action on error banner |
| Renderer → Main | `session:open-mic-settings` | — | User clicked "Grant access in Windows Settings" action |
| Renderer → Main | `session:dismiss-error` | — | User dismissed error banner |
| Renderer → Main | `log:get-path` | — | Request log file path |
| Renderer → Main | `log:reveal` | — | Reveal log file/directory in OS file manager |
| Main → Renderer | `audio:level` | `number` | Current audio input level in dB (smoothed), sent on each audio chunk during recording |

## File Structure

```
stex/
  src/
    main/
      index.ts              # Electron main entry
      tray.ts               # Tray Manager
      window.ts             # Window Manager (overlay + settings windows)
      hotkey.ts             # Hotkey Manager
      settings.ts           # Settings Store
      audio.ts              # Audio IPC relay (receives chunks from renderer)
      soniox.ts             # Soniox WebSocket Client
      session.ts            # Session Manager (orchestration)
    renderer/
      overlay/
        index.html           # Overlay window page
        index.tsx            # React entry for overlay
        audio-capture.ts     # Audio capture via getUserMedia + AudioWorklet
        editor/
          Editor.tsx          # Lexical editor wrapper
          GhostTextPlugin.tsx # Ghost text rendering
          plugins.ts          # Other Lexical plugins
        components/
          StatusBar.tsx        # Recording indicator, pause, clear, copy
          TitleBar.tsx         # Custom frameless title bar
      settings/
        index.html           # Settings window page
        index.tsx            # React entry for settings
        pages/
          General.tsx         # Theme, behavior prefs
          ApiKey.tsx          # Soniox API key config
          Hotkeys.tsx         # Hotkey customization
          History.tsx         # Transcription history (future)
    preload/
      index.ts               # Overlay preload bridge (exposes window.api)
      settings-preload.ts    # Settings preload bridge (exposes window.settingsApi)
    shared/
      types.ts               # Shared types (IPC channels, settings, tokens)
      ipc.ts                 # IPC channel name constants
      preload.d.ts           # Type declarations for window.api and window.settingsApi bridges
  package.json
  electron-builder.json      # Build/packaging config
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron |
| UI framework | React |
| Text editor | Lexical |
| Audio capture | getUserMedia + AudioWorklet in renderer process |
| Speech-to-text | Soniox WebSocket API |
| Build/package | electron-builder |
| Language | TypeScript throughout |
