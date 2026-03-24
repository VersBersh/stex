import { describe, it, expect } from 'vitest';
import { computeDbFromPcm16, createAudioLevelMonitor } from './audio-level-monitor';

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
  it('returns smoothed value from push', () => {
    const monitor = createAudioLevelMonitor(3);
    const result = monitor.push(-30);
    expect(typeof result).toBe('number');
  });

  it('averages over window size', () => {
    const monitor = createAudioLevelMonitor(3);
    monitor.push(-30);
    monitor.push(-20);
    const avg = monitor.push(-10);
    // Average of -30, -20, -10 = -20
    expect(avg).toBe(-20);
  });

  it('slides the window (drops oldest)', () => {
    const monitor = createAudioLevelMonitor(2);
    monitor.push(-40);
    monitor.push(-20);
    // Window: [-40, -20], avg = -30
    const result = monitor.push(-10);
    // Window: [-20, -10], avg = -15
    expect(result).toBe(-15);
  });

  it('returns the single value when window has one entry', () => {
    const monitor = createAudioLevelMonitor(5);
    const result = monitor.push(-25);
    expect(result).toBe(-25);
  });

  it('handles partial window (fewer values than window size)', () => {
    const monitor = createAudioLevelMonitor(5);
    monitor.push(-40);
    const result = monitor.push(-20);
    // Average of -40, -20 = -30
    expect(result).toBe(-30);
  });

  it('defaults to window size 5', () => {
    const monitor = createAudioLevelMonitor();
    // Push 5 values
    monitor.push(-50);
    monitor.push(-40);
    monitor.push(-30);
    monitor.push(-20);
    monitor.push(-10);
    // Average = (-50+-40+-30+-20+-10)/5 = -30
    const avg1 = monitor.push(-10);
    // Window is now [-40,-30,-20,-10,-10], avg = -22
    expect(avg1).toBe(-22);
  });
});
