import { describe, it, expect } from 'vitest';
import { mergeTokens, flushPending, type MergedToken } from './tokenMerger';
import type { SonioxToken } from '../../../shared/types';

function tok(text: string, startMs: number, endMs: number): SonioxToken {
  return { text, start_ms: startMs, end_ms: endMs, confidence: 0.95, is_final: true };
}

describe('mergeTokens', () => {
  it('returns a single word as pending (not yet complete)', () => {
    const result = mergeTokens([], [tok(' hello', 100, 200)]);
    expect(result.words).toEqual([]);
    expect(result.newPending).toEqual([tok(' hello', 100, 200)]);
  });

  it('emits completed words and buffers the last', () => {
    const result = mergeTokens([], [
      tok(' hello', 100, 200),
      tok(' world', 300, 400),
    ]);
    expect(result.words).toEqual([
      { text: ' hello', startMs: 100, endMs: 200, originalText: ' hello' },
    ]);
    expect(result.newPending).toEqual([tok(' world', 300, 400)]);
  });

  it('merges sub-word chunks within a batch', () => {
    const result = mergeTokens([], [
      tok('Hell', 100, 150),
      tok('o,', 150, 200),
      tok(' world', 300, 400),
    ]);
    expect(result.words).toEqual([
      { text: 'Hello,', startMs: 100, endMs: 200, originalText: 'Hello,' },
    ]);
    expect(result.newPending).toEqual([tok(' world', 300, 400)]);
  });

  it('handles cross-batch word continuation', () => {
    // Batch 1: partial word buffered
    const r1 = mergeTokens([], [tok('Hell', 100, 150)]);
    expect(r1.words).toEqual([]);
    expect(r1.newPending).toHaveLength(1);

    // Batch 2: continuation + new word
    const r2 = mergeTokens(r1.newPending, [tok('o,', 150, 200), tok(' world', 300, 400)]);
    expect(r2.words).toEqual([
      { text: 'Hello,', startMs: 100, endMs: 200, originalText: 'Hello,' },
    ]);
    expect(r2.newPending).toEqual([tok(' world', 300, 400)]);
  });

  it('treats the first token as a word start even without leading space', () => {
    const result = mergeTokens([], [
      tok('Hello', 100, 200),
      tok(' world', 300, 400),
    ]);
    expect(result.words).toEqual([
      { text: 'Hello', startMs: 100, endMs: 200, originalText: 'Hello' },
    ]);
  });

  it('handles multi-word batch with sub-word splits', () => {
    const result = mergeTokens([], [
      tok(' h', 100, 120),
      tok('ope', 120, 150),
      tok(' y', 200, 220),
      tok('ou', 220, 250),
      tok("'", 250, 260),
      tok('re', 260, 280),
      tok(' do', 300, 320),
      tok('ing', 320, 350),
      tok(' well', 400, 450),
    ]);
    // 4 groups: [" h","ope"], [" y","ou","'","re"], [" do","ing"], [" well"]
    // First 3 are complete words, last is pending
    expect(result.words).toHaveLength(3);
    expect(result.words[0].text).toBe(' hope');
    expect(result.words[1].text).toBe(" you're");
    expect(result.words[2].text).toBe(' doing');
    expect(result.newPending).toEqual([tok(' well', 400, 450)]);
  });

  it('returns empty words and pending for empty incoming with no pending', () => {
    const result = mergeTokens([], []);
    expect(result.words).toEqual([]);
    expect(result.newPending).toEqual([]);
  });

  it('preserves pending when incoming is empty', () => {
    const pending = [tok('Hell', 100, 150)];
    const result = mergeTokens(pending, []);
    expect(result.words).toEqual([]);
    expect(result.newPending).toEqual(pending);
  });

  it('filters out tokens with empty text', () => {
    const result = mergeTokens([], [
      tok('', 0, 0),
      tok(' hello', 100, 200),
      tok('', 0, 0),
      tok(' world', 300, 400),
    ]);
    expect(result.words).toEqual([
      { text: ' hello', startMs: 100, endMs: 200, originalText: ' hello' },
    ]);
    expect(result.newPending).toEqual([tok(' world', 300, 400)]);
  });

  it('handles punctuation-only continuation tokens', () => {
    const result = mergeTokens([], [
      tok(' test', 100, 200),
      tok('.', 200, 220),
      tok(' next', 300, 400),
    ]);
    expect(result.words).toEqual([
      { text: ' test.', startMs: 100, endMs: 220, originalText: ' test.' },
    ]);
    expect(result.newPending).toEqual([tok(' next', 300, 400)]);
  });

  it('handles question mark as continuation', () => {
    const result = mergeTokens([], [
      tok(' y', 7980, 8040),
      tok('ou', 8100, 8160),
      tok('?', 8160, 8160),
      tok(' I', 10740, 10800),
    ]);
    expect(result.words).toEqual([
      { text: ' you?', startMs: 7980, endMs: 8160, originalText: ' you?' },
    ]);
    expect(result.newPending).toEqual([tok(' I', 10740, 10800)]);
  });
});

describe('flushPending', () => {
  it('returns null for empty pending', () => {
    expect(flushPending([])).toBeNull();
  });

  it('converts a single pending token into a merged word', () => {
    const result = flushPending([tok(' hello', 100, 200)]);
    expect(result).toEqual({
      text: ' hello',
      startMs: 100,
      endMs: 200,
      originalText: ' hello',
    });
  });

  it('merges multiple pending tokens into one word', () => {
    const result = flushPending([
      tok('Hell', 100, 150),
      tok('o,', 150, 200),
    ]);
    expect(result).toEqual({
      text: 'Hello,',
      startMs: 100,
      endMs: 200,
      originalText: 'Hello,',
    });
  });

  it('filters empty-text tokens in pending', () => {
    const result = flushPending([tok('', 0, 0), tok(' hi', 100, 200)]);
    expect(result).toEqual({
      text: ' hi',
      startMs: 100,
      endMs: 200,
      originalText: ' hi',
    });
  });

  it('returns null when all pending tokens have empty text', () => {
    expect(flushPending([tok('', 0, 0), tok('', 0, 0)])).toBeNull();
  });
});
