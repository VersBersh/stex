export interface SonioxToken {
  text: string;
  start_ms: number;
  end_ms: number;
  confidence: number;
  is_final: boolean;
  speaker?: string;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  source: "soniox";
  startMs: number;
  endMs: number;
  confidence: number;
}

export interface EditorBlock {
  id: string;
  text: string;
  source: "soniox" | "user";
  modified: boolean;
}

export interface GhostText {
  tokens: SonioxToken[];
  text: string;
}

export interface ErrorInfo {
  type: 'api-key' | 'rate-limit' | 'mic-denied' | 'mic-unavailable' | 'network' | 'unknown';
  message: string;
  action?: { label: string; action: string };
}

export interface SessionState {
  status: "idle" | "connecting" | "recording" | "paused" | "finalizing" | "error" | "disconnected" | "reconnecting";
  blocks: EditorBlock[];
  ghostText: GhostText | null;
  websocketConnected: boolean;
  microphoneActive: boolean;
  error?: string;
}

export interface AppSettings {
  hotkey: string;
  launchOnStartup: boolean;
  onHide: "clipboard" | "none";
  onShow: "fresh" | "append";
  audioInputDevice: string | null;
  sonioxApiKey: string;
  sonioxModel: string;
  language: string;
  maxEndpointDelayMs: number;
  theme: "system" | "light" | "dark";
  windowPosition: { x: number; y: number } | null;
  windowSize: { width: number; height: number };
}

export interface AudioDevice {
  id: number;
  name: string;
  maxInputChannels: number;
  defaultSampleRate: number;
}

export type ResolvedTheme = "light" | "dark";

export interface TranscriptionRecord {
  id: string;
  text: string;
  createdAt: string;
  durationMs: number;
  language: string;
}
