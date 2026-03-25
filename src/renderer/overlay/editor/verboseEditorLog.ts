export function isVerboseEditorLog(): boolean {
  return localStorage.getItem('VERBOSE_EDITOR_LOG') === 'true';
}

export function verboseLog(label: string, ...args: unknown[]): void {
  console.debug(`[VerboseEditor] [${label}]`, ...args);
}
