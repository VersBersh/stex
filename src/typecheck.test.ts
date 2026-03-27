import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('typecheck', () => {
  it('main and shared sources pass tsc', () => {
    expect(() =>
      execSync('npx tsc --noEmit -p tsconfig.main.json', { encoding: 'utf-8' }),
    ).not.toThrow();
  });

  it('renderer and shared sources pass tsc', () => {
    expect(() =>
      execSync('npx tsc --noEmit -p tsconfig.renderer.json', { encoding: 'utf-8' }),
    ).not.toThrow();
  });

  it('preload sources pass tsc', () => {
    expect(() =>
      execSync('npx tsc --noEmit -p tsconfig.preload.json', { encoding: 'utf-8' }),
    ).not.toThrow();
  });
});
