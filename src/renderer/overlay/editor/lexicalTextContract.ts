import { $getRoot } from 'lexical';

/**
 * Paragraph separator used by Lexical's $getRoot().getTextContent().
 * Lexical joins ParagraphNode children with this string.
 * Verified against Lexical v0.22.x.
 *
 * If a Lexical upgrade changes this, update this constant and
 * fix any code that depends on the separator format.
 */
export const LEXICAL_PARAGRAPH_SEPARATOR = '\n\n';

/**
 * Reads the full document text from the Lexical editor state.
 * Must be called inside a Lexical read/update callback (e.g., editorState.read()).
 *
 * Paragraphs are joined by LEXICAL_PARAGRAPH_SEPARATOR ('\n\n').
 */
export function $getDocumentText(): string {
  return $getRoot().getTextContent();
}
