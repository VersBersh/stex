import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEditorBlockManager,
  createBlockHistory,
  type EditorBlockManager,
  type BlockHistory,
} from './editorBlockManager';
import type { SonioxToken } from '../../../shared/types';

function makeToken(text: string): SonioxToken {
  return { text, start_ms: 0, end_ms: 100, confidence: 0.95, is_final: true };
}

/**
 * Tests the BlockHistory controller — the same operations the
 * UndoRedoBlockSyncPlugin delegates to via captureBeforeEdit,
 * handleUndo, handleRedo, and clear.
 */
describe('BlockHistory controller', () => {
  let manager: EditorBlockManager;
  let blockHistory: BlockHistory;

  beforeEach(() => {
    manager = createEditorBlockManager();
    blockHistory = createBlockHistory(manager);
  });

  describe('captureBeforeEdit', () => {
    it('captures pre-edit snapshot when a new edit occurs', () => {
      manager.commitFinalTokens([makeToken('Hello world')]);

      blockHistory.captureBeforeEdit();
      manager.applyEdit(5, 1, '-');

      expect(blockHistory.undoSize).toBe(1);
      // The snapshot should contain the pre-edit state
      blockHistory.handleUndo();
      expect(manager.getBlocks()[0].text).toBe('Hello world');
      expect(manager.getBlocks()[0].modified).toBe(false);
    });

    it('clears redo stack on new capture', () => {
      manager.commitFinalTokens([makeToken('Hello world')]);

      // Edit, then undo to fill redo
      blockHistory.captureBeforeEdit();
      manager.applyEdit(5, 1, '-');
      blockHistory.handleUndo();

      expect(blockHistory.redoSize).toBe(1);

      // New edit clears redo
      blockHistory.captureBeforeEdit();
      manager.applyEdit(5, 1, '!');

      expect(blockHistory.redoSize).toBe(0);
    });
  });

  describe('handleUndo', () => {
    it('restores pre-edit block state and moves current to redo stack', () => {
      manager.commitFinalTokens([makeToken('Hello world')]);

      blockHistory.captureBeforeEdit();
      manager.applyEdit(5, 1, '-');

      blockHistory.handleUndo();

      expect(manager.getBlocks()[0].text).toBe('Hello world');
      expect(manager.getBlocks()[0].modified).toBe(false);
      expect(blockHistory.undoSize).toBe(0);
      expect(blockHistory.redoSize).toBe(1);
    });

    it('is a no-op when undo stack is empty', () => {
      manager.commitFinalTokens([makeToken('Hello')]);

      blockHistory.handleUndo();

      expect(manager.getBlocks()[0].text).toBe('Hello');
      expect(blockHistory.redoSize).toBe(0);
    });
  });

  describe('handleRedo', () => {
    it('restores post-edit block state and moves current to undo stack', () => {
      manager.commitFinalTokens([makeToken('Hello world')]);

      blockHistory.captureBeforeEdit();
      manager.applyEdit(5, 1, '-');
      blockHistory.handleUndo();

      blockHistory.handleRedo();

      expect(manager.getBlocks()[0].text).toBe('Hello-world');
      expect(manager.getBlocks()[0].modified).toBe(true);
      expect(blockHistory.undoSize).toBe(1);
      expect(blockHistory.redoSize).toBe(0);
    });

    it('is a no-op when redo stack is empty', () => {
      manager.commitFinalTokens([makeToken('Hello')]);

      blockHistory.handleRedo();

      expect(manager.getBlocks()[0].text).toBe('Hello');
      expect(blockHistory.undoSize).toBe(0);
    });
  });

  describe('clear (token commit)', () => {
    it('removes all snapshots from both stacks', () => {
      manager.commitFinalTokens([makeToken('Hello world')]);

      // Edit + undo to populate both stacks
      blockHistory.captureBeforeEdit();
      manager.applyEdit(5, 1, '-');
      blockHistory.handleUndo();

      expect(blockHistory.undoSize).toBe(0);
      expect(blockHistory.redoSize).toBe(1);

      blockHistory.clear();

      expect(blockHistory.undoSize).toBe(0);
      expect(blockHistory.redoSize).toBe(0);
    });

    it('no stale snapshots restored after clear + new edits', () => {
      manager.commitFinalTokens([makeToken('Old text')]);

      blockHistory.captureBeforeEdit();
      manager.applyEdit(0, 3, 'New');

      // Token commit clears everything
      blockHistory.clear();
      manager.clear();
      manager.commitFinalTokens([makeToken('Fresh start')]);

      // New edit after clear
      blockHistory.captureBeforeEdit();
      manager.applyEdit(5, 1, '-');

      // Undo should restore to "Fresh start", not "Old text"
      blockHistory.handleUndo();
      expect(manager.getDocumentText()).toBe('Fresh start');
    });
  });

  describe('multiple undo/redo cycles', () => {
    it('supports multiple edits then multiple undos then redos', () => {
      manager.commitFinalTokens([makeToken('ABCDE')]);

      // Edit 1: ABCDE -> AbCDE
      blockHistory.captureBeforeEdit();
      manager.applyEdit(1, 1, 'b');

      // Edit 2: AbCDE -> AbcDE
      blockHistory.captureBeforeEdit();
      manager.applyEdit(2, 1, 'c');

      // Edit 3: AbcDE -> AbcdE
      blockHistory.captureBeforeEdit();
      manager.applyEdit(3, 1, 'd');

      expect(manager.getDocumentText()).toBe('AbcdE');
      expect(blockHistory.undoSize).toBe(3);

      // Undo all 3
      blockHistory.handleUndo();
      expect(manager.getDocumentText()).toBe('AbcDE');

      blockHistory.handleUndo();
      expect(manager.getDocumentText()).toBe('AbCDE');

      blockHistory.handleUndo();
      expect(manager.getDocumentText()).toBe('ABCDE');
      expect(manager.getBlocks()[0].modified).toBe(false);

      // Redo all 3
      for (let i = 0; i < 3; i++) {
        blockHistory.handleRedo();
      }
      expect(manager.getDocumentText()).toBe('AbcdE');
      expect(manager.getBlocks()[0].modified).toBe(true);
    });
  });
});
