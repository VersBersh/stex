declare const __SEED_EDITOR__: boolean;

export function isVerboseEditorLog(): boolean {
  return __SEED_EDITOR__ || localStorage.getItem('VERBOSE_EDITOR_LOG') === 'true';
}

export function verboseLog(label: string, ...args: unknown[]): void {
  console.debug(`[VerboseEditor] [${label}]`, ...args);
}
