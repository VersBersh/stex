import { describe, it, expect, afterEach } from 'vitest';
import { resolveSonioxApiKey } from './settings';

describe('resolveSonioxApiKey', () => {
  const originalEnv = process.env.SONIOX_API_KEY;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SONIOX_API_KEY;
    } else {
      process.env.SONIOX_API_KEY = originalEnv;
    }
  });

  it('returns saved value when non-empty, ignoring env var', () => {
    process.env.SONIOX_API_KEY = 'env-key-123';
    expect(resolveSonioxApiKey('saved-key-456')).toBe('saved-key-456');
  });

  it('falls back to env var when saved value is empty', () => {
    process.env.SONIOX_API_KEY = 'env-key-123';
    expect(resolveSonioxApiKey('')).toBe('env-key-123');
  });

  it('returns empty string when neither saved value nor env var is set', () => {
    delete process.env.SONIOX_API_KEY;
    expect(resolveSonioxApiKey('')).toBe('');
  });

  it('treats whitespace-only saved value as non-empty', () => {
    process.env.SONIOX_API_KEY = 'env-key-123';
    expect(resolveSonioxApiKey('  ')).toBe('  ');
  });
});
