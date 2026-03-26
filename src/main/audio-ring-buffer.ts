const SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2;
const BYTES_PER_MS = (SAMPLE_RATE * BYTES_PER_SAMPLE) / 1000; // 32
const DEFAULT_CAPACITY_MS = 5 * 60 * 1000; // 5 minutes

interface StoredChunk {
  data: Buffer;
  startMs: number;
}

export class AudioRingBuffer {
  private readonly capacityBytes: number;
  private chunks: StoredChunk[] = [];
  private totalSamples = 0;
  private totalBytes = 0;

  constructor(capacityMs: number = DEFAULT_CAPACITY_MS) {
    this.capacityBytes = capacityMs * BYTES_PER_MS;
  }

  push(chunk: Buffer): void {
    const startMs = (this.totalSamples / SAMPLE_RATE) * 1000;
    this.chunks.push({ data: chunk, startMs });
    this.totalSamples += chunk.length / BYTES_PER_SAMPLE;
    this.totalBytes += chunk.length;

    while (this.totalBytes > this.capacityBytes && this.chunks.length > 0) {
      const evicted = this.chunks.shift()!;
      this.totalBytes -= evicted.data.length;
    }
  }

  sliceFrom(ms: number): Buffer | null {
    if (this.chunks.length === 0) return null;
    if (ms < this.chunks[0].startMs) return null;
    if (ms >= this.currentMs) return null;

    // Binary search for the last chunk with startMs <= ms
    let lo = 0;
    let hi = this.chunks.length - 1;
    let idx = 0;

    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (this.chunks[mid].startMs <= ms) {
        idx = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    return Buffer.concat(
      this.chunks.slice(idx).map((c) => c.data),
    );
  }

  clear(): void {
    this.chunks = [];
    this.totalSamples = 0;
    this.totalBytes = 0;
  }

  get currentMs(): number {
    return (this.totalSamples / SAMPLE_RATE) * 1000;
  }

  get oldestMs(): number | null {
    return this.chunks[0]?.startMs ?? null;
  }
}
