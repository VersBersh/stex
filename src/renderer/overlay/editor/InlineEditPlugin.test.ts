import { describe, it, expect } from 'vitest';
import { findTextDiff } from './InlineEditPlugin';

describe('findTextDiff', () => {
  it('detects insertion at end', () => {
    expect(findTextDiff('Hello', 'Hello world')).toEqual({
      offset: 5,
      removedLength: 0,
      insertedText: ' world',
    });
  });

  it('detects insertion mid-text', () => {
    expect(findTextDiff('Hllo', 'Hello')).toEqual({
      offset: 1,
      removedLength: 0,
      insertedText: 'e',
    });
  });

  it('detects deletion', () => {
    expect(findTextDiff('Hello world', 'Hello')).toEqual({
      offset: 5,
      removedLength: 6,
      insertedText: '',
    });
  });

  it('detects replacement', () => {
    expect(findTextDiff('Hello world', 'Hello earth')).toEqual({
      offset: 6,
      removedLength: 5,
      insertedText: 'earth',
    });
  });

  it('returns null when no change', () => {
    expect(findTextDiff('Hello', 'Hello')).toBeNull();
  });

  it('detects empty to non-empty', () => {
    expect(findTextDiff('', 'Hello')).toEqual({
      offset: 0,
      removedLength: 0,
      insertedText: 'Hello',
    });
  });

  it('detects non-empty to empty', () => {
    expect(findTextDiff('Hello', '')).toEqual({
      offset: 0,
      removedLength: 5,
      insertedText: '',
    });
  });

  it('detects single character insertion at beginning', () => {
    expect(findTextDiff('ello', 'Hello')).toEqual({
      offset: 0,
      removedLength: 0,
      insertedText: 'H',
    });
  });

  it('detects single character deletion at beginning', () => {
    expect(findTextDiff('Hello', 'ello')).toEqual({
      offset: 0,
      removedLength: 1,
      insertedText: '',
    });
  });

  it('handles replacement at beginning', () => {
    expect(findTextDiff('Hello world', 'Howdy world')).toEqual({
      offset: 1,
      removedLength: 4,
      insertedText: 'owdy',
    });
  });
});
