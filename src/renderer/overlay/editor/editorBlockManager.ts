import type { EditorBlock, SonioxToken } from '../../../shared/types';

export function createEditorBlockManager() {
  let blocks: EditorBlock[] = [];
  let nextBlockId = 1;

  function generateBlockId(): string {
    return `block-${nextBlockId++}`;
  }

  return {
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
  };
}

export type EditorBlockManager = ReturnType<typeof createEditorBlockManager>;
