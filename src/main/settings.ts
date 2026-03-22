/**
 * Resolves the effective Soniox API key using precedence rules:
 * 1. Non-empty saved value (from settings.json) wins
 * 2. Falls back to SONIOX_API_KEY environment variable
 * 3. Returns "" if neither is available
 */
export function resolveSonioxApiKey(savedValue: string): string {
  if (savedValue) {
    return savedValue;
  }
  return process.env.SONIOX_API_KEY ?? "";
}
