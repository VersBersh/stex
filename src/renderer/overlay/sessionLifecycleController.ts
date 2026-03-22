export interface SessionLifecycleApi {
  onSessionStart(callback: (onShow: 'fresh' | 'append') => void): () => void;
}

export function createSessionLifecycleController(
  api: SessionLifecycleApi,
  clearEditor: () => void,
) {
  const unsub = api.onSessionStart((onShow) => {
    if (onShow === 'fresh') {
      clearEditor();
    }
  });

  return {
    destroy() {
      unsub();
    },
  };
}
