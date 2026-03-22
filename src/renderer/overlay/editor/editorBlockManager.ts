import type { EditorBlock, SonioxToken } from '../../../shared/types';

export function createEditorBlockManager() {
  let blocks: EditorBlock[] = [];
  let nextBlockId = 1;

  function generateBlockId(): string {
    return `block-${nextBlockId++}`;
  }

  function getBlockOffsets(): Array<{ block: EditorBlock; index: number; start: number; end: number }> {
    let offset = 0;
    return blocks.map((b, i) => {
      const start = offset;
      offset += b.text.length;
      return { block: b, index: i, start, end: offset };
    });
  }

  const manager = {
    getBlocks(): ReadonlyArray<Readonly<EditorBlock>> {
      return blocks;
    },

    commitFinalTokens(tokens: SonioxToken[]): void {
      const text = tokens.map((t) => t.text).join('');
      if (text.length === 0) return;

      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock && lastBlock.source === 'soniox' && !lastBlock.modified) {
        lastBlock.text += text;
      } else {
        blocks.push({
          id: generateBlockId(),
          text,
          source: 'soniox',
          modified: false,
        });
      }
    },

    clear(): void {
      blocks = [];
    },

    getDocumentText(): string {
      return blocks.map((b) => b.text).join('');
    },

    getDocumentLength(): number {
      return blocks.reduce((sum, b) => sum + b.text.length, 0);
    },

    applyEdit(changeOffset: number, removedLength: number, insertedText: string): 'tail' | 'mid' {
      const docLen = manager.getDocumentLength();

      // TAIL INSERTION: edit offset is at or beyond the document end, and nothing was removed
      if (changeOffset >= docLen && removedLength === 0) {
        const lastBlock = blocks[blocks.length - 1];
        if (lastBlock && lastBlock.source === 'user') {
          lastBlock.text += insertedText;
        } else {
          blocks.push({
            id: generateBlockId(),
            text: insertedText,
            source: 'user',
            modified: false,
          });
        }
        return 'tail';
      }

      // MID-DOCUMENT EDIT: edit is within existing text
      const offsets = getBlockOffsets();

      for (const entry of offsets) {
        if (changeOffset < entry.end || (changeOffset === entry.end && entry.index === offsets.length - 1)) {
          const localOffset = changeOffset - entry.start;
          const block = entry.block;

          const removedInBlock = Math.min(removedLength, block.text.length - localOffset);
          block.text = block.text.slice(0, localOffset) + insertedText + block.text.slice(localOffset + removedInBlock);

          if (block.source === 'soniox' && !block.modified) {
            block.modified = true;
          }

          // Handle cross-block removal
          let remainingRemoval = removedLength - removedInBlock;
          let nextIndex = entry.index + 1;
          while (remainingRemoval > 0 && nextIndex < blocks.length) {
            const nextBlock = blocks[nextIndex];
            if (remainingRemoval >= nextBlock.text.length) {
              remainingRemoval -= nextBlock.text.length;
              blocks.splice(nextIndex, 1);
            } else {
              nextBlock.text = nextBlock.text.slice(remainingRemoval);
              if (nextBlock.source === 'soniox' && !nextBlock.modified) {
                nextBlock.modified = true;
              }
              remainingRemoval = 0;
            }
          }

          // Prune the affected block if it became empty
          if (block.text.length === 0) {
            blocks.splice(entry.index, 1);
          }

          return 'mid';
        }
      }

      // Offset beyond all blocks — treat as tail insertion
      return manager.applyEdit(docLen, removedLength, insertedText);
    },
  };

  return manager;
}

export type EditorBlockManager = ReturnType<typeof createEditorBlockManager>;
