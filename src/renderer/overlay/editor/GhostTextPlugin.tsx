import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { SonioxToken } from '../../../shared/types';
import { escapeForCSSContent } from './ghost-text-utils';

export function GhostTextPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const unsub = window.api.onTokensNonfinal((tokens: SonioxToken[]) => {
      const root = editor.getRootElement();
      if (!root) return;

      const text = tokens.map(t => t.text).join('');
      if (text) {
        root.style.setProperty('--ghost-text-content', escapeForCSSContent(text));
      } else {
        root.style.removeProperty('--ghost-text-content');
      }
    });

    return () => {
      unsub();
      const root = editor.getRootElement();
      if (root) {
        root.style.removeProperty('--ghost-text-content');
      }
    };
  }, [editor]);

  return null;
}
