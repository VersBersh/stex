const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const MULTIPLIER = 2;

export function getReconnectDelay(attempt: number): number {
  return Math.min(INITIAL_DELAY_MS * Math.pow(MULTIPLIER, attempt), MAX_DELAY_MS);
}
