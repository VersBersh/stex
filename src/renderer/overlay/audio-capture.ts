const BATCH_SIZE = 1600; // ~100ms at 16kHz

const PROCESSOR_SOURCE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(${BATCH_SIZE});
    this._offset = 0;

    this.port.onmessage = (event) => {
      if (event.data === 'flush') {
        this._flush();
      }
    };
  }

  _flush() {
    if (this._offset > 0) {
      const int16 = new Int16Array(this._offset);
      for (let i = 0; i < this._offset; i++) {
        const s = Math.max(-1, Math.min(1, this._buffer[i]));
        int16[i] = s < 0 ? s * 32768 : s * 32767;
      }
      this.port.postMessage(int16.buffer, [int16.buffer]);
      this._buffer = new Float32Array(${BATCH_SIZE});
      this._offset = 0;
    }
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];
    let srcOffset = 0;

    while (srcOffset < channelData.length) {
      const remaining = ${BATCH_SIZE} - this._offset;
      const toCopy = Math.min(remaining, channelData.length - srcOffset);
      this._buffer.set(channelData.subarray(srcOffset, srcOffset + toCopy), this._offset);
      this._offset += toCopy;
      srcOffset += toCopy;

      if (this._offset >= ${BATCH_SIZE}) {
        const int16 = new Int16Array(${BATCH_SIZE});
        for (let i = 0; i < ${BATCH_SIZE}; i++) {
          const s = Math.max(-1, Math.min(1, this._buffer[i]));
          int16[i] = s < 0 ? s * 32768 : s * 32767;
        }
        this.port.postMessage(int16.buffer, [int16.buffer]);
        this._buffer = new Float32Array(${BATCH_SIZE});
        this._offset = 0;
      }
    }

    return true;
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
`;

let audioContext: AudioContext | null = null;
let mediaStream: MediaStream | null = null;
let workletNode: AudioWorkletNode | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;

function normalizeAudioError(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
        return 'Microphone access denied';
      case 'NotFoundError':
        return 'Audio device not found';
      case 'NotReadableError':
        return 'Audio device unavailable';
      default:
        return err.message;
    }
  }
  return (err as Error).message ?? String(err);
}

export async function startAudioCapture(
  deviceName: string | null,
  onChunk: (pcm16Buffer: ArrayBuffer) => void,
  onError: (err: Error) => void,
  log: (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void = () => {},
): Promise<void> {
  stopAudioCapture();

  try {
    // Resolve device ID from name
    let deviceId: string | undefined;
    if (deviceName) {
      log('debug', `Resolving audio device: ${deviceName}`);
      const devices = await navigator.mediaDevices.enumerateDevices();
      const match = devices.find(d => d.kind === 'audioinput' && d.label === deviceName);
      if (!match) {
        throw new Error(`Audio device not found: ${deviceName}`);
      }
      deviceId = match.deviceId;
      log('debug', `Audio device resolved: ${deviceId}`);
    }

    const constraints: MediaStreamConstraints = {
      audio: {
        channelCount: 1,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    };

    log('debug', 'Calling getUserMedia');
    mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    const track = mediaStream.getAudioTracks()[0];
    const settings = track?.getSettings();
    log('info', `getUserMedia succeeded: track=${track?.label} sampleRate=${settings?.sampleRate} channels=${settings?.channelCount}`);

    audioContext = new AudioContext({ sampleRate: 16000 });
    log('debug', `AudioContext created: state=${audioContext.state} sampleRate=${audioContext.sampleRate}`);

    const blob = new Blob([PROCESSOR_SOURCE], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    try {
      log('debug', 'Loading AudioWorklet module');
      await audioContext.audioWorklet.addModule(blobUrl);
      log('debug', 'AudioWorklet module loaded');
    } finally {
      URL.revokeObjectURL(blobUrl);
    }

    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    workletNode = new AudioWorkletNode(audioContext, 'pcm-capture-processor');

    let chunkCount = 0;
    workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      chunkCount++;
      if (chunkCount === 1) {
        log('info', `Audio capture first chunk: size=${event.data.byteLength}`);
      }
      onChunk(event.data);
    };

    workletNode.onprocessorerror = () => {
      log('error', 'AudioWorklet processor error');
      onError(new Error('Audio processor error'));
    };

    sourceNode.connect(workletNode);
    workletNode.connect(audioContext.destination);
    log('info', 'Audio capture started');
  } catch (err) {
    log('error', `Audio capture failed: ${normalizeAudioError(err)}`);
    stopAudioCapture();
    throw new Error(normalizeAudioError(err));
  }
}

export function stopAudioCapture(): void {
  if (workletNode) {
    // Flush any partial batch before disconnecting
    workletNode.port.postMessage('flush');
    workletNode.port.onmessage = null;
    workletNode.onprocessorerror = null;
    workletNode.disconnect();
    workletNode = null;
  }

  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }

  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
}
