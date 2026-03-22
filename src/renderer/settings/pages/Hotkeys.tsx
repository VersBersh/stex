import React, { useState, useCallback } from 'react';
import type { AppSettings } from '../../../shared/types';

interface Props {
  settings: AppSettings;
  onSettingChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

const DOM_TO_ELECTRON: Record<string, string> = {
  ' ': 'Space',
  'ArrowUp': 'Up',
  'ArrowDown': 'Down',
  'ArrowLeft': 'Left',
  'ArrowRight': 'Right',
  'Escape': 'Esc',
  'Enter': 'Return',
  'Backspace': 'Backspace',
  'Delete': 'Delete',
  'Tab': 'Tab',
  'Home': 'Home',
  'End': 'End',
  'PageUp': 'PageUp',
  'PageDown': 'PageDown',
  'Insert': 'Insert',
  'PrintScreen': 'PrintScreen',
  'ScrollLock': 'ScrollLock',
  'Pause': 'Pause',
};

function domKeyToElectron(key: string): string | null {
  if (DOM_TO_ELECTRON[key]) return DOM_TO_ELECTRON[key];
  if (key.length === 1) return key.toUpperCase();
  if (/^F(\d{1,2})$/.test(key)) return key;
  return null;
}

function keyEventToAccelerator(e: React.KeyboardEvent): string | null {
  const key = e.key;
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
    return null;
  }

  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Super');

  if (parts.length === 0) {
    return null;
  }

  const electronKey = domKeyToElectron(key);
  if (!electronKey) return null;

  parts.push(electronKey);
  return parts.join('+');
}

export function Hotkeys({ settings, onSettingChange }: Props) {
  const [recording, setRecording] = useState(false);
  const [pendingHotkey, setPendingHotkey] = useState<string | null>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const accelerator = keyEventToAccelerator(e);
    if (accelerator) {
      setPendingHotkey(accelerator);
      setRecording(false);
    }
  }, []);

  const handleSave = () => {
    if (pendingHotkey) {
      onSettingChange('hotkey', pendingHotkey);
      setPendingHotkey(null);
    }
  };

  const handleCancel = () => {
    setPendingHotkey(null);
    setRecording(false);
  };

  const displayHotkey = pendingHotkey ?? settings.hotkey;

  return (
    <div>
      <h2>Hotkeys</h2>
      <div className="setting-group">
        <label>Global Shortcut</label>
        <div className="hotkey-display">{displayHotkey}</div>
        <div
          className={`hotkey-recorder ${recording ? 'recording' : ''}`}
          tabIndex={0}
          role="button"
          onClick={() => setRecording(true)}
          onKeyDown={recording ? handleKeyDown : undefined}
        >
          {recording
            ? 'Press your desired key combination...'
            : 'Click here to record a new shortcut'}
        </div>
        <p className="hint">
          This shortcut toggles the transcription overlay from any application.
        </p>
      </div>
      {pendingHotkey && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
          <button type="button" className="btn" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
