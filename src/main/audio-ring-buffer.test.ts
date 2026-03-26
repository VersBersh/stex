import { describe, it, expect, beforeEach } from 'vitest';
import { AudioRingBuffer } from './audio-ring-buffer';

/** Helper: create a PCM buffer with `sampleCount` samples (2 bytes each). */
function pcm(sampleCount: number): Buffer {
  return Buffer.alloc(sampleCount * 2);
}

/** Helper: create a PCM buffer tagged with a 16-bit value at offset 0 for identification. */
function taggedPcm(sampleCount: number, tag: number): Buffer {
  const b = Buffer.alloc(sampleCount * 2);
  b.writeInt16LE(tag, 0);
  return b;
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

  describe('integration: recording-then-pause retrieval', () => {
    it('retrieves all recorded audio after pause', () => {
      // Simulate recording: push 5 chunks (500ms total), each tagged
      const tags = [1001, 1002, 1003, 1004, 1005];
      for (const tag of tags) {
        buf.push(taggedPcm(1600, tag)); // 100ms each
      }
      expect(buf.currentMs).toBe(500);

      // Simulate pause: retrieve all buffered audio via sliceFrom(0)
      const result = buf.sliceFrom(0);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(5 * 3200);

      // Verify each chunk's tag appears in order
      for (let i = 0; i < tags.length; i++) {
        expect(result!.readInt16LE(i * 3200)).toBe(tags[i]);
      }
    });

    it('retrieves audio from the middle of buffered data', () => {
      // Record 5 chunks: 0ms, 100ms, 200ms, 300ms, 400ms
      buf.push(taggedPcm(1600, 10));
      buf.push(taggedPcm(1600, 20));
      buf.push(taggedPcm(1600, 30));
      buf.push(taggedPcm(1600, 40));
      buf.push(taggedPcm(1600, 50));

      // Pause and retrieve from 200ms — should get chunks 200ms, 300ms, 400ms
      const result = buf.sliceFrom(200);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(3 * 3200);
      expect(result!.readInt16LE(0)).toBe(30);
      expect(result!.readInt16LE(3200)).toBe(40);
      expect(result!.readInt16LE(6400)).toBe(50);
    });

    it('retrieves audio from a mid-chunk timestamp', () => {
      buf.push(taggedPcm(1600, 10)); // 0–100ms
      buf.push(taggedPcm(1600, 20)); // 100–200ms
      buf.push(taggedPcm(1600, 30)); // 200–300ms

      // Slice at 150ms — falls inside the 100–200ms chunk, returns from that chunk onward
      const result = buf.sliceFrom(150);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(2 * 3200);
      expect(result!.readInt16LE(0)).toBe(20);
      expect(result!.readInt16LE(3200)).toBe(30);
    });

    it('retrieves correct data after wrap-around eviction', () => {
      // 1-second capacity = 32000 bytes = 10 chunks of 3200 bytes
      // Push 15 chunks (1500ms) so first 5 are evicted
      const tags: number[] = [];
      for (let i = 0; i < 15; i++) {
        tags.push(100 + i);
        buf.push(taggedPcm(1600, 100 + i));
      }

      // Evicted: chunks 0–4 (tags 100–104), surviving: chunks 5–14 (tags 105–114)
      const oldest = buf.oldestMs!;
      expect(oldest).toBeGreaterThan(0);
      expect(buf.sliceFrom(0)).toBeNull(); // evicted range

      // Retrieve surviving audio from oldest timestamp
      const result = buf.sliceFrom(oldest);
      expect(result).not.toBeNull();

      // Verify the first surviving chunk has the expected tag
      const expectedFirstTag = 100 + Math.round(oldest / 100);
      expect(result!.readInt16LE(0)).toBe(expectedFirstTag);

      // Verify all surviving chunks are present and in order
      const survivingCount = result!.length / 3200;
      for (let i = 0; i < survivingCount; i++) {
        expect(result!.readInt16LE(i * 3200)).toBe(expectedFirstTag + i);
      }
    });

    it('retrieves from mid-point after wrap-around', () => {
      // Push 20 chunks (2000ms) into 1-second buffer
      for (let i = 0; i < 20; i++) {
        buf.push(taggedPcm(1600, 200 + i));
      }

      const oldest = buf.oldestMs!;
      // Slice from a point in the middle of the surviving range
      const midpoint = oldest + 300; // 3 chunks past oldest
      const result = buf.sliceFrom(midpoint);
      expect(result).not.toBeNull();

      // Should be smaller than slicing from oldest
      const fullResult = buf.sliceFrom(oldest)!;
      expect(result!.length).toBeLessThan(fullResult.length);

      // Verify the tag at the start corresponds to the chunk containing midpoint
      const expectedTag = 200 + Math.round(midpoint / 100);
      expect(result!.readInt16LE(0)).toBe(expectedTag);
    });

    it('supports clear-then-record cycle (multiple sessions)', () => {
      // Session 1: record 3 chunks
      buf.push(taggedPcm(1600, 501));
      buf.push(taggedPcm(1600, 502));
      buf.push(taggedPcm(1600, 503));

      const session1 = buf.sliceFrom(0);
      expect(session1).not.toBeNull();
      expect(session1!.readInt16LE(0)).toBe(501);

      // Pause & clear (simulate session boundary)
      buf.clear();
      expect(buf.sliceFrom(0)).toBeNull();

      // Session 2: record new chunks
      buf.push(taggedPcm(1600, 601));
      buf.push(taggedPcm(1600, 602));

      const session2 = buf.sliceFrom(0);
      expect(session2).not.toBeNull();
      expect(session2!.length).toBe(2 * 3200);
      expect(session2!.readInt16LE(0)).toBe(601);
      expect(session2!.readInt16LE(3200)).toBe(602);
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
