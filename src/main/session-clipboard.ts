import { ipcMain, clipboard } from 'electron';
import { IpcChannels } from '../shared/ipc';

const CLIPBOARD_TIMEOUT_MS = 2000;

export function copyEditorTextToClipboard(
  sendToRenderer: (channel: string, ...args: unknown[]) => void,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const handler = (_event: unknown, text: string) => {
      clearTimeout(timer);
      if (text && text.length > 0) {
        clipboard.writeText(text);
        resolve(true);
      } else {
        resolve(false);
      }
    };

    const timer = setTimeout(() => {
      ipcMain.removeListener(IpcChannels.SESSION_TEXT, handler);
      resolve(false);
    }, CLIPBOARD_TIMEOUT_MS);

    ipcMain.once(IpcChannels.SESSION_TEXT, handler);
    sendToRenderer(IpcChannels.SESSION_TEXT);
  });
}
