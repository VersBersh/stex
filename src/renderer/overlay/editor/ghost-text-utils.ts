import type { SonioxToken } from '../../../shared/types';

/**
 * Escapes a string for use in a CSS `content` property value.
 * Returns the string wrapped in double quotes with special characters escaped.
 */
export function escapeForCSSContent(text: string): string {
  return '"' + text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\a ') + '"';
}

export interface GhostTextController {
  handleNonFinalTokens(tokens: SonioxToken[]): void;
  handleFinalTokens(): void;
}

export function createGhostTextController(
  getRoot: () => Pick<HTMLElement, 'style'> | null,
): GhostTextController {
  return {
    handleNonFinalTokens(tokens) {
      const root = getRoot();
      if (!root) return;
      const text = tokens.map(t => t.text).join('');
      if (text) {
        root.style.setProperty('--ghost-text-content', escapeForCSSContent(text));
      } else {
        root.style.removeProperty('--ghost-text-content');
      }
    },
    handleFinalTokens() {
      const root = getRoot();
      if (root) {
        root.style.removeProperty('--ghost-text-content');
      }
    },
  };
}
