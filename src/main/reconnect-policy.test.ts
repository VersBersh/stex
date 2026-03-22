import { describe, it, expect } from 'vitest';
import { getReconnectDelay } from './reconnect-policy';

describe('getReconnectDelay', () => {
  it('returns 1000ms for first attempt', () => {
    expect(getReconnectDelay(0)).toBe(1000);
  });

  it('doubles delay on each attempt', () => {
    expect(getReconnectDelay(1)).toBe(2000);
    expect(getReconnectDelay(2)).toBe(4000);
    expect(getReconnectDelay(3)).toBe(8000);
  });

  it('caps at 30000ms', () => {
    expect(getReconnectDelay(5)).toBe(30000); // 1000 * 2^5 = 32000 > 30000
    expect(getReconnectDelay(10)).toBe(30000);
    expect(getReconnectDelay(100)).toBe(30000);
  });

  it('returns exact value at boundary', () => {
    // 1000 * 2^4 = 16000, under cap
    expect(getReconnectDelay(4)).toBe(16000);
  });
});
