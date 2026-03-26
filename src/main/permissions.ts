import { session } from 'electron';
import { debug } from './logger';

export function initPermissions(): void {
  const ses = session.defaultSession;

  const allowedChecks = new Set(['media', 'clipboard-sanitized-write', 'clipboard-read']);

  ses.setPermissionCheckHandler((_webContents, permission) => {
    const granted = allowedChecks.has(permission);
    debug('Permission check: %s → %s', permission, granted ? 'granted' : 'denied');
    return granted;
  });

  // Auto-approve media permission requests so getUserMedia() never prompts.
  // Deny other permission requests since we don't expect them.
  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      debug('Granting media permission request');
      callback(true);
      return;
    }
    debug('Denying permission request: %s', permission);
    callback(false);
  });
}
