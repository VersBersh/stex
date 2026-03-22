/**
 * Escapes a string for use in a CSS `content` property value.
 * Returns the string wrapped in double quotes with special characters escaped.
 */
export function escapeForCSSContent(text: string): string {
  return '"' + text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\a ') + '"';
}
