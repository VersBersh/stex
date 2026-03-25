import { describe, it, expect } from 'vitest';
import { computeDbFromPcm16, createAudioLevelMonitor, createSoundEventDetector } from './audio-level-monitor';

describe('computeDbFromPcm16', () => {
  it('returns -60 for a silent buffer (all zeros)', () => {
    const buf = Buffer.alloc(320); // 160 samples of silence
    expect(computeDbFromPcm16(buf)).toBe(-60);
  });

  it('returns approximately 0 for max-amplitude buffer', () => {
    // Fill with max positive value (32767)
    const buf = Buffer.alloc(320);
    for (let i = 0; i < 160; i++) {
      buf.writeInt16LE(32767, i * 2);
    }
    const dB = computeDbFromPcm16(buf);
    expect(dB).toBeCloseTo(0, 0);
    expect(dB).toBeLessThanOrEqual(0);
  });

  it('returns correct dB for known RMS value', () => {
    // If every sample = 3277 (roughly 1/10 of max), RMS = 3277
    // dB = 20 * log10(3277 / 32768) ≈ -20.0
    const buf = Buffer.alloc(320);
    for (let i = 0; i < 160; i++) {
      buf.writeInt16LE(3277, i * 2);
    }
    const dB = computeDbFromPcm16(buf);
    expect(dB).toBeCloseTo(-20, 0);
  });

  it('returns -60 for an empty buffer', () => {
    const buf = Buffer.alloc(0);
    expect(computeDbFromPcm16(buf)).toBe(-60);
  });

  it('handles negative sample values', () => {
    const buf = Buffer.alloc(320);
    for (let i = 0; i < 160; i++) {
      buf.writeInt16LE(-32768, i * 2);
    }
    const dB = computeDbFromPcm16(buf);
    expect(dB).toBeCloseTo(0, 0);
  });

  it('clamps very quiet audio to -60', () => {
    // A single sample of value 1 among silence
    const buf = Buffer.alloc(320);
    buf.writeInt16LE(1, 0);
    const dB = computeDbFromPcm16(buf);
    expect(dB).toBe(-60);
  });
});

describe('createAudioLevelMonitor', () => {
  it('snaps immediately to a higher value (fast attack)', () => {
    const monitor = createAudioLevelMonitor();
    monitor.push(-40);
    const result = monitor.push(-10);
    expect(result).toBe(-10);
  });

  it('decays gradually from a higher value (slow release)', () => {
    const monitor = createAudioLevelMonitor(0.35);
    monitor.push(-10);
    const result = monitor.push(-40);
    // Should move toward -40 but not reach it: -10 + (-40 - -10) * 0.35 = -20.5
    expect(result).toBeCloseTo(-20.5);
    expect(result).toBeGreaterThan(-40);
  });

  it('eventually converges to a sustained low level', () => {
    const monitor = createAudioLevelMonitor(0.35);
    monitor.push(-10);
    for (let i = 0; i < 20; i++) {
      monitor.push(-40);
    }
    const result = monitor.push(-40);
    expect(result).toBeCloseTo(-40, 0);
  });

  it('tracks rapidly increasing levels without lag', () => {
    const monitor = createAudioLevelMonitor();
    monitor.push(-50);
    monitor.push(-40);
    monitor.push(-30);
    monitor.push(-20);
    const result = monitor.push(-10);
    // Each step is higher, so each should snap immediately
    expect(result).toBe(-10);
  });

  it('starts from MIN_DB', () => {
    const monitor = createAudioLevelMonitor();
    // First push of a value above MIN_DB should snap to it
    const result = monitor.push(-30);
    expect(result).toBe(-30);
  });
});

describe('createSoundEventDetector', () => {
  const THRESHOLD = -30;
  const CHUNK_MS = 10;

  it('returns null when dB stays below threshold', () => {
    const detector = createSoundEventDetector(THRESHOLD);
    expect(detector.push(-40, CHUNK_MS)).toBeNull();
    expect(detector.push(-50, CHUNK_MS)).toBeNull();
    expect(detector.push(-60, CHUNK_MS)).toBeNull();
  });

  it('returns null when dB equals the threshold', () => {
    const detector = createSoundEventDetector(THRESHOLD);
    expect(detector.push(THRESHOLD, CHUNK_MS)).toBeNull();
  });

  it('returns null while dB is above threshold (event in progress)', () => {
    const detector = createSoundEventDetector(THRESHOLD);
    expect(detector.push(-20, CHUNK_MS)).toBeNull();
    expect(detector.push(-15, CHUNK_MS)).toBeNull();
  });

  it('returns a SoundEvent when dB drops below threshold after being above', () => {
    const detector = createSoundEventDetector(THRESHOLD);
    detector.push(-20, CHUNK_MS); // start event
    const event = detector.push(-40, CHUNK_MS); // end event
    expect(event).not.toBeNull();
    expect(event!.peakDb).toBe(-20);
    expect(event!.durationMs).toBe(CHUNK_MS);
    expect(event!.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('tracks peak correctly across multiple above-threshold chunks', () => {
    const detector = createSoundEventDetector(THRESHOLD);
    detector.push(-25, CHUNK_MS);
    detector.push(-10, CHUNK_MS); // peak
    detector.push(-20, CHUNK_MS);
    const event = detector.push(-40, CHUNK_MS);
    expect(event!.peakDb).toBe(-10);
  });

  it('computes duration by accumulating per-chunk durations', () => {
    const detector = createSoundEventDetector(THRESHOLD);
    detector.push(-20, CHUNK_MS);
    detector.push(-20, CHUNK_MS);
    detector.push(-20, CHUNK_MS);
    const event = detector.push(-40, CHUNK_MS);
    expect(event!.durationMs).toBe(30); // 3 chunks × 10ms
  });

  it('handles variable chunk durations', () => {
    const detector = createSoundEventDetector(THRESHOLD);
    detector.push(-20, 10);
    detector.push(-20, 20);
    detector.push(-20, 15);
    const event = detector.push(-40, 10);
    expect(event!.durationMs).toBe(45); // 10 + 20 + 15
  });

  it('detects consecutive events independently', () => {
    const detector = createSoundEventDetector(THRESHOLD);
    // First event
    detector.push(-20, CHUNK_MS);
    const event1 = detector.push(-40, CHUNK_MS);
    expect(event1).not.toBeNull();
    expect(event1!.peakDb).toBe(-20);

    // Second event
    detector.push(-15, CHUNK_MS);
    detector.push(-10, CHUNK_MS);
    const event2 = detector.push(-40, CHUNK_MS);
    expect(event2).not.toBeNull();
    expect(event2!.peakDb).toBe(-10);
    expect(event2!.durationMs).toBe(20);
  });

  it('handles single-chunk events', () => {
    const detector = createSoundEventDetector(THRESHOLD);
    detector.push(-20, CHUNK_MS);
    const event = detector.push(-40, CHUNK_MS);
    expect(event!.durationMs).toBe(CHUNK_MS);
  });

  it('flush returns in-progress event', () => {
    const detector = createSoundEventDetector(THRESHOLD);
    detector.push(-25, CHUNK_MS);
    detector.push(-10, CHUNK_MS);
    const event = detector.flush();
    expect(event).not.toBeNull();
    expect(event!.peakDb).toBe(-10);
    expect(event!.durationMs).toBe(20);
  });

  it('flush returns null when no event is in progress', () => {
    const detector = createSoundEventDetector(THRESHOLD);
    expect(detector.flush()).toBeNull();
  });

  it('flush resets state so next push starts fresh', () => {
    const detector = createSoundEventDetector(THRESHOLD);
    detector.push(-20, CHUNK_MS);
    detector.flush();
    // Should not be in an event anymore
    expect(detector.flush()).toBeNull();
    // Starting a new event works
    detector.push(-15, CHUNK_MS);
    const event = detector.push(-40, CHUNK_MS);
    expect(event!.peakDb).toBe(-15);
  });
});
