export interface PauseApi {
  onSessionStatus(cb: (status: string) => void): () => void;
  sessionRequestPause(): void;
  sessionRequestResume(): void;
}

export type PauseListener = (paused: boolean) => void;

export function createPauseController(api: PauseApi) {
  let paused = false;
  const listeners = new Set<PauseListener>();

  function setPaused(value: boolean) {
    if (paused !== value) {
      paused = value;
      listeners.forEach(l => l(paused));
    }
  }

  const unsub = api.onSessionStatus((status) => setPaused(status === 'paused'));

  return {
    isPaused: () => paused,
    toggle() {
      if (paused) api.sessionRequestResume();
      else api.sessionRequestPause();
    },
    subscribe(listener: PauseListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      unsub();
      listeners.clear();
    },
  };
}
