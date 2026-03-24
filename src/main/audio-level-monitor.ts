export const MIN_DB = -60;

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

export interface SoundEvent {
  peakDb: number;
  durationMs: number;
  timestamp: string;
}

export interface SoundEventDetector {
  push(dB: number, chunkDurationMs: number): SoundEvent | null;
  flush(): SoundEvent | null;
}

export function createSoundEventDetector(thresholdDb: number): SoundEventDetector {
  let inEvent = false;
  let eventStartTime = '';
  let peakDb = -Infinity;
  let accumulatedMs = 0;

  function endEvent(): SoundEvent {
    const event: SoundEvent = {
      peakDb,
      durationMs: accumulatedMs,
      timestamp: eventStartTime,
    };
    inEvent = false;
    eventStartTime = '';
    peakDb = -Infinity;
    accumulatedMs = 0;
    return event;
  }

  return {
    push(dB: number, chunkDurationMs: number): SoundEvent | null {
      if (dB > thresholdDb) {
        if (!inEvent) {
          inEvent = true;
          eventStartTime = new Date().toISOString();
          peakDb = dB;
          accumulatedMs = chunkDurationMs;
        } else {
          if (dB > peakDb) peakDb = dB;
          accumulatedMs += chunkDurationMs;
        }
        return null;
      }
      if (inEvent) {
        return endEvent();
      }
      return null;
    },
    flush(): SoundEvent | null {
      if (inEvent) {
        return endEvent();
      }
      return null;
    },
  };
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
