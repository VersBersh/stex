import WebSocket from 'ws';
import { SonioxToken, AppSettings } from '../shared/types';
import { info, debug } from './logger';

const SONIOX_ENDPOINT = 'wss://stt-rt.soniox.com/transcribe-websocket';

export interface SonioxResponse {
  tokens: SonioxToken[];
  final_audio_proc_ms: number;
  total_audio_proc_ms: number;
  finished?: boolean;
}

export interface SonioxClientEvents {
  onFinalTokens: (tokens: SonioxToken[]) => void;
  onNonFinalTokens: (tokens: SonioxToken[]) => void;
  onFinished: () => void;
  onConnected: () => void;
  onDisconnected: (code: number, reason: string) => void;
  onError: (error: Error) => void;
}

export class SonioxClient {
  private ws: WebSocket | null = null;
  private lastFinalProcMs = 0;
  private events: Partial<SonioxClientEvents>;

  constructor(events: Partial<SonioxClientEvents>) {
    this.events = events;
  }

  get connected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  connect(settings: AppSettings): void {
    if (this.ws) {
      this.disconnect();
    }

    this.lastFinalProcMs = 0;
    info('Soniox WebSocket connecting to %s', SONIOX_ENDPOINT);
    const socket = new WebSocket(SONIOX_ENDPOINT);
    this.ws = socket;

    socket.on('open', () => {
      if (socket !== this.ws) return;
      debug('Soniox WebSocket connected');
      const config = {
        api_key: settings.sonioxApiKey,
        model: settings.sonioxModel,
        audio_format: 'pcm_s16le',
        sample_rate: 16000,
        num_channels: 1,
        language_hints: [settings.language],
        max_endpoint_delay_ms: settings.maxEndpointDelayMs,
      };
      debug('Soniox config: model=%s, language=%s, max_endpoint_delay_ms=%d',
        config.model, config.language_hints[0], config.max_endpoint_delay_ms);
      socket.send(JSON.stringify(config));
      this.events.onConnected?.();
    });

    socket.on('message', (data: WebSocket.Data) => {
      if (socket !== this.ws) return;
      this.handleMessage(data);
    });

    socket.on('close', (code: number, reason: Buffer) => {
      if (socket !== this.ws) return;
      info('Soniox WebSocket closed (code=%d, reason=%s)', code, reason.toString() || '(none)');
      this.events.onDisconnected?.(code, reason.toString());
    });

    socket.on('error', (err: Error) => {
      if (socket !== this.ws) return;
      this.events.onError?.(err);
    });
  }

  sendAudio(chunk: Buffer): void {
    if (!this.connected) return;
    this.ws!.send(chunk);
  }

  finalize(): void {
    if (!this.connected) return;
    this.ws!.send(Buffer.alloc(0));
  }

  disconnect(): void {
    debug('Soniox WebSocket disconnect requested');
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.on('error', () => {}); // Swallow errors during close
      this.ws.close();
      this.ws = null;
    }
  }

  private handleMessage(data: WebSocket.Data): void {
    let response: SonioxResponse;
    try {
      const text = typeof data === 'string' ? data : Buffer.from(data as ArrayBuffer).toString('utf-8');
      response = JSON.parse(text);
    } catch (err) {
      this.events.onError?.(new Error(`Failed to parse Soniox response: ${err}`));
      return;
    }

    const newFinalTokens = response.tokens.filter(
      (t) => t.is_final && t.start_ms >= this.lastFinalProcMs,
    );
    const nonFinalTokens = response.tokens.filter((t) => !t.is_final);

    if (newFinalTokens.length > 0) {
      this.events.onFinalTokens?.(newFinalTokens);
      this.lastFinalProcMs = response.final_audio_proc_ms;
    }

    if (nonFinalTokens.length > 0) {
      this.events.onNonFinalTokens?.(nonFinalTokens);
    }

    if (response.finished) {
      this.events.onFinished?.();
    }
  }
}
