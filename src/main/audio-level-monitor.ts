const MIN_DB = -60;

export function computeDbFromPcm16(chunk: Buffer): number {
  const sampleCount = Math.floor(chunk.length / 2);
  if (sampleCount === 0) return MIN_DB;

  let sumSquares = 0;
  for (let i = 0; i < sampleCount; i++) {
    const sample = chunk.readInt16LE(i * 2);
    sumSquares += sample * sample;
  }

  const rms = Math.sqrt(sumSquares / sampleCount);
  if (rms < 1) return MIN_DB;

  const dB = 20 * Math.log10(rms / 32768);
  return Math.max(MIN_DB, dB);
}

export interface AudioLevelMonitor {
  push(dB: number): number;
}

export function createAudioLevelMonitor(windowSize = 5): AudioLevelMonitor {
  const effectiveSize = Math.max(1, windowSize);
  const buffer: number[] = [];

  return {
    push(dB: number): number {
      buffer.push(dB);
      if (buffer.length > effectiveSize) {
        buffer.shift();
      }
      let sum = 0;
      for (const val of buffer) {
        sum += val;
      }
      return sum / buffer.length;
    },
  };
}
