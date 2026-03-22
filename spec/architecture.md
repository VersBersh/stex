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
|  |  Hotkey Manager  |  |  Audio Capture   |  |  Soniox Client   |  |
|  |                  |  |                  |  |                  |  |
|  |  - Register      |  |  - naudiodon /   |  |  - WebSocket     |  |
|  |    global hotkey |  |    PortAudio     |  |    connection    |  |
|  |  - Dispatch      |  |  - PCM s16le     |  |  - Send audio    |  |
|  |    show/hide     |  |    16kHz mono    |  |  - Receive       |  |
|  |                  |  |  - Stream to     |  |    tokens        |  |
|  |                  |  |    Soniox client |  |  - Track final   |  |
|  |                  |  |                  |  |    vs non-final  |  |
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
| **Window Manager** | Creates two BrowserWindows: the overlay (frameless, always-on-top, no taskbar) and the settings window. Handles show/hide, persists overlay position/size |
| **Hotkey Manager** | Registers the global hotkey via `globalShortcut`, sends show/hide commands to Window Manager |
| **Settings Store** | Reads/writes `settings.json` using `electron-store` or similar. Exposes settings to both renderers via IPC. `getSettings()` returns *effective* settings: for `sonioxApiKey`, the store applies resolution precedence (non-empty saved value > `SONIOX_API_KEY` env var > empty string) — the resolved value is never written back to disk |
| **Audio Capture** | Opens the microphone via `naudiodon` (PortAudio bindings). Produces PCM s16le 16kHz mono chunks. Streams audio data directly to the Soniox Client. Uses the system default input device unless overridden in settings. If the selected device becomes unavailable (e.g. USB headset unplugged), stops capture and shows an error — user must resume manually after reconnecting the device. |
| **Soniox Client** | Manages WebSocket connection to Soniox. Receives audio from Audio Capture, sends it as binary frames. Receives token responses, separates final/non-final, and forwards to renderer via IPC |
| **Session Manager** | Orchestrates the lifecycle: on "start" → init audio + connect WebSocket; on "stop" → close audio + send empty frame for finalization + wait for response; on "pause" → stop mic capture, send empty frame, wait for finalization, keep WS alive; on "resume" → restart mic capture. Manages state transitions and notifies renderer |

### Renderer Process (Overlay)

| Component | Responsibility |
|-----------|---------------|
| **Lexical Editor** | The user-facing text surface. Custom plugins handle: appending committed text from final tokens, rendering ghost text from non-final tokens, preserving cursor position during updates |
| **Ghost Text Plugin** | Lexical plugin that renders non-final tokens as read-only, styled (muted italic) text at the document tail. Replaces on each update |
| **Status Bar** | Displays recording state, pause/resume button, clear and copy actions |

### Renderer Process (Settings)

| Component | Responsibility |
|-----------|---------------|
| **Settings UI** | Form-based UI for API key, hotkey config, audio input device selection, theme, behavior preferences. Reads/writes via IPC to Settings Store |
| **History UI** | (Future) Browse and search past transcription sessions |

## Data Flow

```
Microphone
    |
    v
naudiodon / PortAudio (Main Process)
    |  PCM s16le 16kHz mono
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
| Main → Renderer | `session:start` | — | Signal session started (clear editor if fresh mode) |
| Main → Renderer | `session:stop` | — | Signal session ended |
| Main → Renderer | `session:paused` | — | Signal recording paused |
| Main → Renderer | `session:resumed` | — | Signal recording resumed |
| Main → Renderer | `tokens:final` | `SonioxToken[]` | New finalized tokens to commit to editor |
| Main → Renderer | `tokens:nonfinal` | `SonioxToken[]` | Current non-final tokens (replaces previous ghost text) |
| Main → Renderer | `session:status` | `SessionState.status` | Status changes (connecting, recording, error, etc.) |
| Renderer → Main | `session:text` | `string` | Send final text for clipboard on hide |
| Renderer → Main | `session:request-pause` | — | User clicked pause button |
| Renderer → Main | `session:request-resume` | — | User clicked resume button |
| Main → Renderer | `settings:updated` | `AppSettings` | Push settings changes |

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
      audio.ts              # Audio Capture (naudiodon / PortAudio)
      soniox.ts             # Soniox WebSocket Client
      session.ts            # Session Manager (orchestration)
    renderer/
      overlay/
        index.html           # Overlay window page
        index.tsx            # React entry for overlay
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
    shared/
      types.ts               # Shared types (IPC channels, settings, tokens)
      ipc.ts                 # IPC channel name constants
  package.json
  electron-builder.json      # Build/packaging config
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron |
| UI framework | React |
| Text editor | Lexical |
| Audio capture | naudiodon (PortAudio) in main process |
| Speech-to-text | Soniox WebSocket API |
| Build/package | electron-builder |
| Language | TypeScript throughout |
