import { describe, it, expect, beforeEach } from 'vitest';
import { AudioRingBuffer } from './audio-ring-buffer';

/** Helper: create a PCM buffer with `sampleCount` samples (2 bytes each). */
function pcm(sampleCount: number): Buffer {
  return Buffer.alloc(sampleCount * 2);
}

describe('AudioRingBuffer', () => {
  let buf: AudioRingBuffer;

  beforeEach(() => {
    // 1-second capacity for easy testing (16000 samples = 32000 bytes)
    buf = new AudioRingBuffer(1000);
  });

  describe('push', () => {
    it('advances currentMs based on sample count', () => {
      expect(buf.currentMs).toBe(0);

      // 1600 samples = 100ms at 16kHz
      buf.push(pcm(1600));
      expect(buf.currentMs).toBe(100);

      buf.push(pcm(800));
      expect(buf.currentMs).toBe(150);
    });

    it('tracks oldestMs as the first buffered chunk', () => {
      expect(buf.oldestMs).toBeNull();

      buf.push(pcm(1600));
      expect(buf.oldestMs).toBe(0);

      buf.push(pcm(1600));
      expect(buf.oldestMs).toBe(0);
    });

    it('handles single-sample chunks', () => {
      buf.push(pcm(1));
      expect(buf.currentMs).toBeCloseTo(1 / 16);
    });
  });

  describe('sliceFrom', () => {
    it('returns null for empty buffer', () => {
      expect(buf.sliceFrom(0)).toBeNull();
    });

    it('returns correct audio for a given timestamp', () => {
      const chunk1 = pcm(1600); // 0–100ms
      chunk1.writeInt16LE(1111, 0); // tag for identification
      const chunk2 = pcm(1600); // 100–200ms
      chunk2.writeInt16LE(2222, 0);

      buf.push(chunk1);
      buf.push(chunk2);

      // Slice from 100ms should return chunk2 only
      const result = buf.sliceFrom(100);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(3200);
      expect(result!.readInt16LE(0)).toBe(2222);
    });

    it('returns all audio when slicing from 0', () => {
      buf.push(pcm(1600));
      buf.push(pcm(1600));

      const result = buf.sliceFrom(0);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(6400);
    });

    it('returns data from containing chunk when timestamp falls mid-chunk', () => {
      const chunk1 = pcm(1600); // 0–100ms
      chunk1.writeInt16LE(1111, 0);
      const chunk2 = pcm(1600); // 100–200ms
      chunk2.writeInt16LE(2222, 0);

      buf.push(chunk1);
      buf.push(chunk2);

      // 50ms is inside chunk1 (0–100ms), so should return from chunk1 onward
      const result = buf.sliceFrom(50);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(6400);
      expect(result!.readInt16LE(0)).toBe(1111);
    });

    it('returns data when timestamp matches the latest chunk', () => {
      buf.push(pcm(1600)); // 0–100ms
      const chunk2 = pcm(1600); // 100–200ms
      chunk2.writeInt16LE(9999, 0);
      buf.push(chunk2);

      const result = buf.sliceFrom(100);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(3200);
      expect(result!.readInt16LE(0)).toBe(9999);
    });

    it('returns null when requested timestamp has been evicted', () => {
      // Fill beyond 1-second capacity
      for (let i = 0; i < 12; i++) {
        buf.push(pcm(1600)); // 12 × 100ms = 1200ms total
      }

      // Oldest chunk should be around 200ms now (evicted 0ms and 100ms)
      expect(buf.sliceFrom(0)).toBeNull();
    });

    it('returns null when requested timestamp is before oldest buffered chunk', () => {
      // Push and evict so oldest is not at 0
      for (let i = 0; i < 15; i++) {
        buf.push(pcm(1600));
      }

      const oldest = buf.oldestMs!;
      expect(oldest).toBeGreaterThan(0);
      expect(buf.sliceFrom(oldest - 1)).toBeNull();
    });

    it('returns null when timestamp equals currentMs (no audio from that point)', () => {
      buf.push(pcm(1600)); // 0–100ms
      expect(buf.sliceFrom(100)).toBeNull();
    });

    it('returns null when timestamp is beyond currentMs', () => {
      buf.push(pcm(1600)); // 0–100ms
      expect(buf.sliceFrom(200)).toBeNull();
    });

    it('handles exact match on chunk boundary', () => {
      const chunk1 = pcm(1600); // 0ms
      chunk1.writeInt16LE(1111, 0);
      const chunk2 = pcm(1600); // 100ms
      chunk2.writeInt16LE(2222, 0);
      const chunk3 = pcm(1600); // 200ms
      chunk3.writeInt16LE(3333, 0);

      buf.push(chunk1);
      buf.push(chunk2);
      buf.push(chunk3);

      const result = buf.sliceFrom(200);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(3200);
      expect(result!.readInt16LE(0)).toBe(3333);
    });
  });

  describe('circular eviction', () => {
    it('drops oldest chunks when capacity is exceeded', () => {
      // 1-second capacity = 32000 bytes = 10 chunks of 1600 samples (3200 bytes each)
      for (let i = 0; i < 15; i++) {
        buf.push(pcm(1600));
      }

      // Buffer should hold at most ~1000ms worth
      const oldest = buf.oldestMs!;
      const head = buf.currentMs;
      expect(head - oldest).toBeLessThanOrEqual(1000);
    });

    it('updates oldestMs after eviction', () => {
      buf.push(pcm(1600)); // 0ms
      expect(buf.oldestMs).toBe(0);

      // Push enough to evict the first chunk
      for (let i = 0; i < 10; i++) {
        buf.push(pcm(1600));
      }

      expect(buf.oldestMs).toBeGreaterThan(0);
    });

    it('sliceFrom returns null for evicted range', () => {
      // Push 2 seconds into a 1-second buffer
      for (let i = 0; i < 20; i++) {
        buf.push(pcm(1600));
      }

      // First second should be evicted
      expect(buf.sliceFrom(0)).toBeNull();
      expect(buf.sliceFrom(50)).toBeNull();

      // Recent audio should still be available
      const oldest = buf.oldestMs!;
      expect(buf.sliceFrom(oldest)).not.toBeNull();
    });
  });

  describe('clear', () => {
    it('resets currentMs to 0', () => {
      buf.push(pcm(1600));
      expect(buf.currentMs).toBe(100);

      buf.clear();
      expect(buf.currentMs).toBe(0);
    });

    it('resets oldestMs to null', () => {
      buf.push(pcm(1600));
      expect(buf.oldestMs).toBe(0);

      buf.clear();
      expect(buf.oldestMs).toBeNull();
    });

    it('empties buffer so sliceFrom returns null', () => {
      buf.push(pcm(1600));
      expect(buf.sliceFrom(0)).not.toBeNull();

      buf.clear();
      expect(buf.sliceFrom(0)).toBeNull();
    });

    it('allows push after clear with fresh timestamps', () => {
      buf.push(pcm(1600));
      buf.clear();

      const chunk = pcm(1600);
      chunk.writeInt16LE(4444, 0);
      buf.push(chunk);

      expect(buf.currentMs).toBe(100);
      expect(buf.oldestMs).toBe(0);

      const result = buf.sliceFrom(0);
      expect(result).not.toBeNull();
      expect(result!.readInt16LE(0)).toBe(4444);
    });
  });

  describe('default capacity', () => {
    it('uses 5-minute capacity by default', () => {
      const defaultBuf = new AudioRingBuffer();
      // Push 5 minutes of audio
      const chunkSamples = 16000; // 1 second
      for (let i = 0; i < 300; i++) {
        defaultBuf.push(pcm(chunkSamples));
      }
      expect(defaultBuf.currentMs).toBe(300000); // 5 minutes

      // All should still be buffered
      expect(defaultBuf.sliceFrom(0)).not.toBeNull();

      // Push one more second to trigger eviction
      defaultBuf.push(pcm(chunkSamples));
      expect(defaultBuf.oldestMs).toBeGreaterThan(0);
    });
  });
});
