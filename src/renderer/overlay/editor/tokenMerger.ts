import type { SonioxToken } from '../../../shared/types';

export interface MergedToken {
  text: string;
  startMs: number;
  endMs: number;
  originalText: string;
}

export interface MergeResult {
  words: MergedToken[];
  newPending: SonioxToken[];
}

function tokenStartsWord(token: SonioxToken): boolean {
  return token.text.startsWith(' ');
}

function groupToMergedToken(group: SonioxToken[]): MergedToken {
  const text = group.map((t) => t.text).join('');
  return {
    text,
    startMs: group[0].start_ms,
    endMs: group[group.length - 1].end_ms,
    originalText: text,
  };
}

/**
 * Merge sub-word Soniox tokens into word-level tokens.
 *
 * Word boundary rule: a token whose text starts with a space begins a new word.
 * The first token in the combined (pending + incoming) sequence always begins
 * a new word regardless of leading space.
 *
 * The last group is always returned as `newPending` since it may be continued
 * by the next batch. Call `flushPending` when the stream ends to emit it.
 */
export function mergeTokens(pending: SonioxToken[], incoming: SonioxToken[]): MergeResult {
  const combined = [...pending, ...incoming].filter((t) => t.text.length > 0);
  if (combined.length === 0) {
    return { words: [], newPending: [] };
  }

  const groups: SonioxToken[][] = [];
  for (const token of combined) {
    if (groups.length === 0 || tokenStartsWord(token)) {
      groups.push([token]);
    } else {
      groups[groups.length - 1].push(token);
    }
  }

  // All complete groups become words; the last group stays pending
  const words = groups.slice(0, -1).map(groupToMergedToken);
  const newPending = groups[groups.length - 1];

  return { words, newPending };
}

/**
 * Flush remaining pending tokens as a final merged word.
 * Call on session pause or stop to emit the buffered partial word.
 */
export function flushPending(pending: SonioxToken[]): MergedToken | null {
  const filtered = pending.filter((t) => t.text.length > 0);
  if (filtered.length === 0) return null;
  return groupToMergedToken(filtered);
}
