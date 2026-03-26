# Plan

## Goal

Implement `AudioRingBuffer`, a circular buffer class that stores timestamped PCM audio chunks with a 5-minute capacity, supporting `push`, `sliceFrom`, and `clear` operations.

## Steps

### 1. Create `src/main/audio-ring-buffer.ts`

Create a new module exporting the `AudioRingBuffer` class.

**Internal data model:**
- `chunks: Array<{ data: Buffer; startMs: number }>` — simple array; oldest at index 0, newest at end
- `totalSamples: number` — monotonic sample counter (never resets except on `clear()`)
- `totalBytes: number` — total bytes currently buffered (for capacity tracking)

No ring-array index management — use plain `push()` to append and `shift()` to evict. Chunk count is modest (~3000 for 5 min at 100ms/chunk) so `shift()` is fine.

**Constants:**
- `SAMPLE_RATE = 16000` — 16kHz
- `BYTES_PER_SAMPLE = 2` — 16-bit PCM
- `BYTES_PER_MS = SAMPLE_RATE * BYTES_PER_SAMPLE / 1000` — = 32
- `DEFAULT_CAPACITY_MS = 5 * 60 * 1000` — 5 minutes
- `DEFAULT_CAPACITY_BYTES = DEFAULT_CAPACITY_MS * BYTES_PER_MS` — ~9,600,000 bytes

**Constructor:** `constructor(capacityMs: number = DEFAULT_CAPACITY_MS)`
- Stores `capacityBytes = capacityMs * BYTES_PER_MS`
- Initializes empty state

**`push(chunk: Buffer): void`**
1. Compute `chunkStartMs = totalSamples / SAMPLE_RATE * 1000` (i.e., `totalSamples / 16`)
2. Append `{ data: chunk, startMs: chunkStartMs }` to `chunks`
3. Increment `totalSamples += chunk.length / 2`
4. Add `chunk.length` to `totalBytes`
5. Evict oldest chunks from front (`chunks.shift()`) while `totalBytes > capacityBytes`, subtracting evicted chunk's `data.length` from `totalBytes`

**`sliceFrom(ms: number): Buffer | null`**
1. If buffer is empty, return `null`
2. If `ms < chunks[0].startMs` (requested timestamp predates all buffered audio — has been evicted), return `null`
3. Binary search for the last chunk with `startMs <= ms`. This is the chunk that contains or starts at the requested timestamp.
4. Concatenate all chunk `data` from that index through the end into a single `Buffer` via `Buffer.concat()`
5. Return the concatenated buffer

**`clear(): void`**
- Reset `chunks` to empty array, `totalSamples = 0`, `totalBytes = 0`

**Getter `currentMs: number`** — returns `totalSamples / SAMPLE_RATE * 1000` (current session audio time in ms)

**Getter `oldestMs: number | null`** — returns `chunks[0]?.startMs ?? null` (oldest buffered timestamp, or null if empty)

### 2. Create `src/main/audio-ring-buffer.test.ts`

Test file covering:
- **push**: advances `currentMs` correctly based on sample count
- **push**: `oldestMs` tracks the first buffered chunk
- **sliceFrom**: returns correct audio for a given timestamp
- **sliceFrom**: returns correct audio when timestamp falls mid-chunk (returns from containing chunk)
- **sliceFrom**: returns `null` for empty buffer
- **sliceFrom**: returns `null` when timestamp has been evicted
- **sliceFrom**: handles exact match on chunk boundary
- **sliceFrom**: returns data when timestamp matches the latest chunk
- **Circular eviction**: oldest chunks are dropped when capacity exceeded
- **Circular eviction**: `oldestMs` updates after eviction
- **Circular eviction**: `sliceFrom` returns `null` for evicted range
- **clear**: resets `currentMs`, `oldestMs`, and empties buffer
- **Edge cases**: single-sample chunks, push after clear

## Risks / Open Questions

- **`currentMs` and `oldestMs` getters**: These are not in the spec's explicit API list (`push`, `sliceFrom`, `clear`) but are useful for consumers (e.g., `soniox-lifecycle.ts` needs to know the current session time). They are simple derived properties, not behavioral additions. If the spec should be updated to document them, that can be done separately.
- **Cross-spec reconciliation**: The proposal (`spec/proposal-context-refresh.md`) changes the pause/resume model from "resume on same connection" to "close A, open B." This conflicts with descriptions in `spec/api.md` and `spec/features/inline-editing.md`. Those cross-spec updates are out of scope for this task (ring-buffer-only); they should be addressed by the tasks that implement the connection handoff.
- **`sliceFrom` with mid-chunk timestamp**: Returns audio starting from the chunk whose `startMs <= ms`. This may include a few extra milliseconds at the start, which is acceptable for replay (Soniox handles slightly earlier audio fine).
- **Array shift vs ring array**: `Array.shift()` is O(n) but n is small (~3000 chunks). If profiling shows issues, can switch to a true circular buffer with pre-allocated array.
