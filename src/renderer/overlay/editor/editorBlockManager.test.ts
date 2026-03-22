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

  describe('getDocumentLength', () => {
    it('returns 0 for empty manager', () => {
      expect(manager.getDocumentLength()).toBe(0);
    });

    it('returns correct total for multiple blocks', () => {
      manager.commitFinalTokens([makeToken('Hello ')]);
      manager.commitFinalTokens([makeToken('world')]);
      expect(manager.getDocumentLength()).toBe(11);
    });

    it('returns correct total after clear', () => {
      manager.commitFinalTokens([makeToken('Hello')]);
      manager.clear();
      expect(manager.getDocumentLength()).toBe(0);
    });
  });

  describe('applyEdit — tail insertion', () => {
    it('creates new user block after soniox block when editing at end', () => {
      manager.commitFinalTokens([makeToken('Hello ')]);
      const result = manager.applyEdit(6, 0, 'world');

      expect(result).toBe('tail');
      const blocks = manager.getBlocks();
      expect(blocks).toHaveLength(2);
      expect(blocks[1]).toMatchObject({
        text: 'world',
        source: 'user',
        modified: false,
      });
    });

    it('extends existing user block at tail', () => {
      manager.commitFinalTokens([makeToken('Hello ')]);
      manager.applyEdit(6, 0, 'wo');
      manager.applyEdit(8, 0, 'rld');

      const blocks = manager.getBlocks();
      expect(blocks).toHaveLength(2);
      expect(blocks[1].text).toBe('world');
      expect(blocks[1].source).toBe('user');
    });

    it('creates user block on empty manager', () => {
      const result = manager.applyEdit(0, 0, 'Hello');

      expect(result).toBe('tail');
      const blocks = manager.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toMatchObject({
        text: 'Hello',
        source: 'user',
        modified: false,
      });
    });
  });

  describe('applyEdit — mid-document edit', () => {
    it('marks soniox block as modified when edited', () => {
      manager.commitFinalTokens([makeToken('Hello world')]);
      const result = manager.applyEdit(5, 1, '-');

      expect(result).toBe('mid');
      const blocks = manager.getBlocks();
      expect(blocks[0].source).toBe('soniox');
      expect(blocks[0].modified).toBe(true);
      expect(blocks[0].text).toBe('Hello-world');
    });

    it('keeps already-modified block as modified', () => {
      manager.commitFinalTokens([makeToken('Hello world')]);
      manager.applyEdit(5, 1, '-'); // first edit marks modified
      manager.applyEdit(0, 5, 'Howdy');

      const blocks = manager.getBlocks();
      expect(blocks[0].modified).toBe(true);
      expect(blocks[0].text).toBe('Howdy-world');
    });

    it('updates user block text without changing source', () => {
      manager.commitFinalTokens([makeToken('Hello ')]);
      manager.applyEdit(6, 0, 'world'); // tail insert creates user block
      manager.applyEdit(6, 5, 'earth'); // mid edit within user block

      const blocks = manager.getBlocks();
      expect(blocks[1].source).toBe('user');
      expect(blocks[1].text).toBe('earth');
    });

    it('handles insertion within a block (no removal)', () => {
      manager.commitFinalTokens([makeToken('Hllo')]);
      const result = manager.applyEdit(1, 0, 'e');

      expect(result).toBe('mid');
      expect(manager.getDocumentText()).toBe('Hello');
    });

    it('handles deletion within a block', () => {
      manager.commitFinalTokens([makeToken('Helllo')]);
      const result = manager.applyEdit(3, 1, '');

      expect(result).toBe('mid');
      expect(manager.getDocumentText()).toBe('Hello');
    });
  });

  describe('applyEdit — cross-block edits', () => {
    it('select+replace spanning two blocks modifies first and trims second', () => {
      manager.commitFinalTokens([makeToken('Hello ')]);
      manager.applyEdit(6, 0, 'beautiful '); // user block
      manager.commitFinalTokens([makeToken('world')]); // new soniox block

      // Replace "ful beauti" (spanning user block into ... wait let me think about offsets)
      // blocks: [soniox: "Hello " (0-6)], [user: "beautiful " (6-16)], [soniox: "world" (16-21)]
      // Select+replace "beautiful world" with "earth" — offset 6, remove 15, insert "earth"
      manager.applyEdit(6, 15, 'earth');

      const blocks = manager.getBlocks();
      // User block gets replacement, soniox block fully consumed and removed
      expect(manager.getDocumentText()).toBe('Hello earth');
    });

    it('deletion spanning a full block removes it', () => {
      manager.commitFinalTokens([makeToken('Hello ')]);
      manager.applyEdit(6, 0, 'X'); // user block: "X"
      manager.commitFinalTokens([makeToken(' world')]); // soniox: " world"

      // blocks: [soniox: "Hello " (0-6)], [user: "X" (6-7)], [soniox: " world" (7-13)]
      // Delete "X" — offset 6, remove 1
      manager.applyEdit(6, 1, '');

      expect(manager.getDocumentText()).toBe('Hello  world');
      const blocks = manager.getBlocks();
      // Empty user block should be pruned, leaving two soniox blocks
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toMatchObject({ text: 'Hello ', source: 'soniox' });
      expect(blocks[1]).toMatchObject({ text: ' world', source: 'soniox' });
    });
  });

  describe('commitFinalTokens after modification', () => {
    it('creates new soniox block when last block is modified', () => {
      manager.commitFinalTokens([makeToken('Hello')]);
      manager.applyEdit(0, 5, 'Howdy'); // marks modified

      manager.commitFinalTokens([makeToken(' world')]);

      const blocks = manager.getBlocks();
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toMatchObject({ text: 'Howdy', source: 'soniox', modified: true });
      expect(blocks[1]).toMatchObject({ text: ' world', source: 'soniox', modified: false });
    });

    it('creates new soniox block when last block is a user block', () => {
      manager.commitFinalTokens([makeToken('Hello ')]);
      manager.applyEdit(6, 0, 'typed'); // tail insert creates user block

      manager.commitFinalTokens([makeToken(' more')]);

      const blocks = manager.getBlocks();
      expect(blocks).toHaveLength(3);
      expect(blocks[2]).toMatchObject({ text: ' more', source: 'soniox', modified: false });
    });
  });

  describe('replaceLastUserBlock', () => {
    it('creates a new user block when no blocks exist', () => {
      manager.replaceLastUserBlock('hello');

      const blocks = manager.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toMatchObject({
        text: 'hello',
        source: 'user',
        modified: false,
      });
    });

    it('creates a new user block after a soniox block', () => {
      manager.commitFinalTokens([makeToken('spoken ')]);
      manager.replaceLastUserBlock('typed');

      const blocks = manager.getBlocks();
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toMatchObject({ text: 'spoken ', source: 'soniox' });
      expect(blocks[1]).toMatchObject({ text: 'typed', source: 'user' });
    });

    it('replaces text of an existing trailing user block', () => {
      manager.replaceLastUserBlock('first');
      manager.replaceLastUserBlock('replaced');

      const blocks = manager.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0].text).toBe('replaced');
    });

    it('removes trailing user block when text is empty', () => {
      manager.replaceLastUserBlock('temp');
      expect(manager.getBlocks()).toHaveLength(1);

      manager.replaceLastUserBlock('');
      expect(manager.getBlocks()).toHaveLength(0);
    });

    it('is a no-op when text is empty and last block is soniox', () => {
      manager.commitFinalTokens([makeToken('spoken')]);
      manager.replaceLastUserBlock('');

      const blocks = manager.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0].source).toBe('soniox');
    });

    it('is a no-op when text is empty and no blocks exist', () => {
      manager.replaceLastUserBlock('');
      expect(manager.getBlocks()).toHaveLength(0);
    });

    it('preserves the block ID when replacing text', () => {
      manager.replaceLastUserBlock('first');
      const id = manager.getBlocks()[0].id;

      manager.replaceLastUserBlock('second');
      expect(manager.getBlocks()[0].id).toBe(id);
    });
  });

  describe('getBaseText', () => {
    it('returns empty string when no blocks exist', () => {
      expect(manager.getBaseText()).toBe('');
    });

    it('returns all block text when last block is soniox', () => {
      manager.commitFinalTokens([makeToken('Hello ')]);
      manager.commitFinalTokens([makeToken('world')]);

      expect(manager.getBaseText()).toBe('Hello world');
    });

    it('returns text of all blocks except trailing user block', () => {
      manager.commitFinalTokens([makeToken('spoken ')]);
      manager.replaceLastUserBlock('typed');

      expect(manager.getBaseText()).toBe('spoken ');
    });

    it('returns empty string when only block is a user block', () => {
      manager.replaceLastUserBlock('typed');

      expect(manager.getBaseText()).toBe('');
    });

    it('includes earlier user blocks that are not trailing', () => {
      manager.replaceLastUserBlock('first-user ');
      manager.commitFinalTokens([makeToken('spoken ')]);
      manager.replaceLastUserBlock('second-user');

      // base text = first-user + spoken (not trailing second-user)
      expect(manager.getBaseText()).toBe('first-user spoken ');
    });
  });

  describe('block alternation', () => {
    it('soniox then user then soniox creates 3 alternating blocks', () => {
      manager.commitFinalTokens([makeToken('edit the ')]);
      manager.replaceLastUserBlock('~/.gitignore');
      manager.commitFinalTokens([makeToken(' file')]);

      const blocks = manager.getBlocks();
      expect(blocks).toHaveLength(3);
      expect(blocks[0]).toMatchObject({ text: 'edit the ', source: 'soniox' });
      expect(blocks[1]).toMatchObject({ text: '~/.gitignore', source: 'user' });
      expect(blocks[2]).toMatchObject({ text: ' file', source: 'soniox' });
      expect(manager.getDocumentText()).toBe('edit the ~/.gitignore file');
    });

    it('soniox then user then soniox then user creates 4 blocks', () => {
      manager.commitFinalTokens([makeToken('A ')]);
      manager.replaceLastUserBlock('B ');
      manager.commitFinalTokens([makeToken('C ')]);
      manager.replaceLastUserBlock('D');

      const blocks = manager.getBlocks();
      expect(blocks).toHaveLength(4);
      expect(blocks.map(b => b.source)).toEqual(['soniox', 'user', 'soniox', 'user']);
      expect(manager.getDocumentText()).toBe('A B C D');
    });

    it('commitFinalTokens after user block creates a new soniox block', () => {
      manager.replaceLastUserBlock('typed');
      manager.commitFinalTokens([makeToken(' spoken')]);

      const blocks = manager.getBlocks();
      expect(blocks).toHaveLength(2);
      expect(blocks[0].source).toBe('user');
      expect(blocks[1].source).toBe('soniox');
    });

    it('deleting user text then new soniox merges into previous soniox', () => {
      manager.commitFinalTokens([makeToken('first ')]);
      manager.replaceLastUserBlock('temp');
      // User deletes their typed text
      manager.replaceLastUserBlock('');
      // New soniox arrives — should merge into the first soniox block
      manager.commitFinalTokens([makeToken('second')]);

      const blocks = manager.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toMatchObject({ text: 'first second', source: 'soniox' });
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
