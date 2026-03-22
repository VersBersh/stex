import { describe, it, expect, beforeEach } from 'vitest';
import { createEditorBlockManager, type EditorBlockManager } from './editorBlockManager';
import type { SonioxToken } from '../../../shared/types';

function makeToken(text: string, isFinal = true): SonioxToken {
  return {
    text,
    start_ms: 0,
    end_ms: 100,
    confidence: 0.95,
    is_final: isFinal,
  };
}

describe('EditorBlockManager', () => {
  let manager: EditorBlockManager;

  beforeEach(() => {
    manager = createEditorBlockManager();
  });

  describe('commitFinalTokens', () => {
    it('creates a new soniox block from the first batch of tokens', () => {
      manager.commitFinalTokens([makeToken('Hello ')]);

      const blocks = manager.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toMatchObject({
        text: 'Hello ',
        source: 'soniox',
        modified: false,
      });
      expect(blocks[0].id).toBeTruthy();
    });

    it('extends the existing soniox block with consecutive token batches', () => {
      manager.commitFinalTokens([makeToken('Hello ')]);
      manager.commitFinalTokens([makeToken('world')]);

      const blocks = manager.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0].text).toBe('Hello world');
    });

    it('concatenates multiple tokens within a single batch', () => {
      manager.commitFinalTokens([
        makeToken('How '),
        makeToken('are '),
        makeToken('you'),
      ]);

      const blocks = manager.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0].text).toBe('How are you');
    });

    it('does not create a block for empty token array', () => {
      manager.commitFinalTokens([]);
      expect(manager.getBlocks()).toHaveLength(0);
    });

    it('does not create a block when all token texts are empty strings', () => {
      manager.commitFinalTokens([makeToken('')]);
      expect(manager.getBlocks()).toHaveLength(0);
    });

    it('assigns unique IDs to each block', () => {
      manager.commitFinalTokens([makeToken('First')]);
      manager.clear();
      manager.commitFinalTokens([makeToken('Second')]);

      // After clear, new block should get a different ID than the first
      const blocks = manager.getBlocks();
      expect(blocks[0].id).toBeTruthy();
    });
  });

  describe('block boundary rules', () => {
    it('all consecutive soniox batches merge into one block (no fragmentation)', () => {
      manager.commitFinalTokens([makeToken('A ')]);
      manager.commitFinalTokens([makeToken('B ')]);
      manager.commitFinalTokens([makeToken('C')]);

      const blocks = manager.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0].text).toBe('A B C');
      expect(blocks[0].source).toBe('soniox');
      expect(blocks[0].modified).toBe(false);
    });

    it('creates new block after clear + new tokens', () => {
      manager.commitFinalTokens([makeToken('Old')]);
      manager.clear();
      manager.commitFinalTokens([makeToken('New')]);

      const blocks = manager.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0].text).toBe('New');
    });
  });

  describe('getDocumentText', () => {
    it('returns empty string when no blocks exist', () => {
      expect(manager.getDocumentText()).toBe('');
    });

    it('returns concatenated text from all blocks', () => {
      manager.commitFinalTokens([makeToken('Hello ')]);
      manager.commitFinalTokens([makeToken('world')]);

      expect(manager.getDocumentText()).toBe('Hello world');
    });
  });

  describe('clear', () => {
    it('removes all blocks', () => {
      manager.commitFinalTokens([makeToken('Hello')]);
      expect(manager.getBlocks()).toHaveLength(1);

      manager.clear();
      expect(manager.getBlocks()).toHaveLength(0);
    });

    it('allows new blocks to be added after clear', () => {
      manager.commitFinalTokens([makeToken('Old')]);
      manager.clear();
      manager.commitFinalTokens([makeToken('New')]);

      const blocks = manager.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0].text).toBe('New');
    });
  });

  describe('independent instances', () => {
    it('each manager has independent block state', () => {
      const manager2 = createEditorBlockManager();

      manager.commitFinalTokens([makeToken('A')]);
      manager2.commitFinalTokens([makeToken('B')]);

      expect(manager.getDocumentText()).toBe('A');
      expect(manager2.getDocumentText()).toBe('B');
    });

    it('each manager has independent ID sequences', () => {
      const manager2 = createEditorBlockManager();

      manager.commitFinalTokens([makeToken('First')]);
      manager2.commitFinalTokens([makeToken('Second')]);

      // Both start their own counter independently
      expect(manager.getBlocks()[0].id).toBeTruthy();
      expect(manager2.getBlocks()[0].id).toBeTruthy();
      // IDs within the same manager increment
      manager.clear();
      manager.commitFinalTokens([makeToken('Third')]);
      expect(manager.getBlocks()[0].id).not.toBe('block-1');
    });
  });
});
