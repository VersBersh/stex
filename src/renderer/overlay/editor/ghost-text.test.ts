import { describe, it, expect, beforeEach } from 'vitest';
import { escapeForCSSContent, createGhostTextController, type GhostTextController } from './ghost-text-utils';
import type { SonioxToken } from '../../../shared/types';

describe('escapeForCSSContent', () => {
  it('wraps plain text in quotes', () => {
    expect(escapeForCSSContent('hello world')).toBe('"hello world"');
  });

  it('escapes backslashes', () => {
    expect(escapeForCSSContent('path\\to\\file')).toBe('"path\\\\to\\\\file"');
  });

  it('escapes double quotes', () => {
    expect(escapeForCSSContent('he said "hi"')).toBe('"he said \\"hi\\""');
  });

  it('escapes newlines as CSS \\a', () => {
    expect(escapeForCSSContent('line1\nline2')).toBe('"line1\\a line2"');
  });

  it('handles empty string', () => {
    expect(escapeForCSSContent('')).toBe('""');
  });

  it('handles combined special characters', () => {
    expect(escapeForCSSContent('a\\b"c\nd')).toBe('"a\\\\b\\"c\\a d"');
  });

  it('handles typical transcription text', () => {
    const text = "I'm speaking and this is the ghost text";
    expect(escapeForCSSContent(text)).toBe(`"I'm speaking and this is the ghost text"`);
  });
});

function makeToken(text: string): SonioxToken {
  return { text, start_ms: 0, end_ms: 100, confidence: 0.95, is_final: false };
}

function createMockStyle() {
  const props = new Map<string, string>();
  return {
    setProperty(key: string, value: string) { props.set(key, value); },
    removeProperty(key: string) { props.delete(key); },
    getPropertyValue(key: string) { return props.get(key) ?? ''; },
    _props: props,
  };
}

describe('createGhostTextController', () => {
  let style: ReturnType<typeof createMockStyle>;
  let controller: GhostTextController;

  beforeEach(() => {
    style = createMockStyle();
    controller = createGhostTextController(() => ({ style } as unknown as HTMLElement));
  });

  it('sets --ghost-text-content on non-final tokens', () => {
    controller.handleNonFinalTokens([makeToken('hello ')]);
    expect(style.getPropertyValue('--ghost-text-content')).toBe('"hello "');
  });

  it('concatenates multiple non-final tokens', () => {
    controller.handleNonFinalTokens([makeToken('hello '), makeToken('world')]);
    expect(style.getPropertyValue('--ghost-text-content')).toBe('"hello world"');
  });

  it('removes --ghost-text-content when non-final tokens are empty', () => {
    controller.handleNonFinalTokens([makeToken('hello')]);
    controller.handleNonFinalTokens([]);
    expect(style.getPropertyValue('--ghost-text-content')).toBe('');
  });

  it('removes --ghost-text-content when non-final token text is empty string', () => {
    controller.handleNonFinalTokens([makeToken('hello')]);
    controller.handleNonFinalTokens([makeToken('')]);
    expect(style.getPropertyValue('--ghost-text-content')).toBe('');
  });

  it('clears ghost text on final tokens', () => {
    controller.handleNonFinalTokens([makeToken('speculative')]);
    expect(style.getPropertyValue('--ghost-text-content')).toBe('"speculative"');

    controller.handleFinalTokens();
    expect(style.getPropertyValue('--ghost-text-content')).toBe('');
  });

  it('allows new ghost text after final tokens clear it', () => {
    controller.handleNonFinalTokens([makeToken('first')]);
    controller.handleFinalTokens();
    controller.handleNonFinalTokens([makeToken('second')]);
    expect(style.getPropertyValue('--ghost-text-content')).toBe('"second"');
  });

  it('full handoff sequence: non-final -> final -> non-final', () => {
    // Step 1: non-final tokens shown as ghost text
    controller.handleNonFinalTokens([makeToken('hello ')]);
    expect(style.getPropertyValue('--ghost-text-content')).toBe('"hello "');

    // Step 2: final tokens arrive, ghost text cleared
    controller.handleFinalTokens();
    expect(style.getPropertyValue('--ghost-text-content')).toBe('');

    // Step 3: new non-final tokens arrive
    controller.handleNonFinalTokens([makeToken('world')]);
    expect(style.getPropertyValue('--ghost-text-content')).toBe('"world"');
  });

  it('is a no-op when getRoot returns null', () => {
    const nullController = createGhostTextController(() => null);
    // Should not throw
    nullController.handleNonFinalTokens([makeToken('hello')]);
    nullController.handleFinalTokens();
  });

  it('handleFinalTokens is idempotent when no ghost text exists', () => {
    // Should not throw when property doesn't exist
    controller.handleFinalTokens();
    expect(style.getPropertyValue('--ghost-text-content')).toBe('');
  });
});
