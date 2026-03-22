import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { createGhostTextController } from './ghost-text-utils';

export function GhostTextPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const controller = createGhostTextController(() => editor.getRootElement());

    const unsubNonFinal = window.api.onTokensNonfinal((tokens) => {
      controller.handleNonFinalTokens(tokens);
    });

    const unsubFinal = window.api.onTokensFinal(() => {
      controller.handleFinalTokens();
    });

    return () => {
      unsubNonFinal();
      unsubFinal();
      controller.handleFinalTokens();
    };
  }, [editor]);

  return null;
}
