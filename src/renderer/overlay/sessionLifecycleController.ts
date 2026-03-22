import type { AppSettings } from '../../shared/types';

export interface SessionLifecycleApi {
  onSessionStart(callback: () => void): () => void;
  settingsGet(): Promise<AppSettings>;
}

export function createSessionLifecycleController(
  api: SessionLifecycleApi,
  clearEditor: () => void,
) {
  let destroyed = false;

  const unsub = api.onSessionStart(() => {
    api.settingsGet().then((settings) => {
      if (!destroyed && settings.onShow === 'fresh') {
        clearEditor();
      }
    }).catch(() => {
      // Settings fetch failed — leave editor unchanged
    });
  });

  return {
    destroy() {
      destroyed = true;
      unsub();
    },
  };
}
