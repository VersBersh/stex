import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { createGhostTextController } from './ghost-text-utils';

export function GhostTextPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const controller = createGhostTextController(() => editor.getRootElement());

    const unsubNonFinal = window.api.onTokensNonfinal((tokens) => {
      // Capture scroll position before mutation (ghost text can increase
      // paragraph height, which would shift scrollHeight).
      let wasNearBottom = false;
      const rootElement = editor.getRootElement();
      if (rootElement) {
        const container = rootElement.parentElement;
        if (container) {
          wasNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
        }
      }

      controller.handleNonFinalTokens(tokens);

      // Scroll to follow ghost text only when the viewport was near the
      // bottom AND content actually overflows after the ghost text renders.
      // Without the overflow check, the first ghost text arrival scrolls
      // even when everything fits, hiding existing text.
      if (wasNearBottom && rootElement) {
        const container = rootElement.parentElement;
        if (container) {
          const overflow = container.scrollHeight - container.scrollTop - container.clientHeight;
          if (overflow > 0) {
            container.scrollTop = container.scrollHeight;
          }
        }
      }
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
