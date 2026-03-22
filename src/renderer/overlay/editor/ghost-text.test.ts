import { describe, it, expect } from 'vitest';
import { escapeForCSSContent } from './ghost-text-utils';

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
