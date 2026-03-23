import React, { useState } from 'react';
import type { AppSettings } from '../../../shared/types';

interface Props {
  settings: AppSettings;
  onSettingChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export function ApiKey({ settings, onSettingChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [saved, setSaved] = useState(false);

  const hasKey = settings.sonioxApiKey.length > 0;

  const handleSave = () => {
    onSettingChange('sonioxApiKey', newValue);
    setEditing(false);
    setNewValue('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCancel = () => {
    setEditing(false);
    setNewValue('');
  };

  const handleRemove = () => {
    onSettingChange('sonioxApiKey', '');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h2>API Key</h2>
      <div className="setting-group">
        <label htmlFor="api-key">Soniox API Key</label>
        {hasKey && !editing ? (
          <div className="password-input">
            <input
              id="api-key"
              type="text"
              value={settings.sonioxApiKey}
              readOnly
            />
            <button
              type="button"
              className="btn"
              onClick={() => setEditing(true)}
            >
              Change
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleRemove}
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="password-input">
            <input
              id="api-key"
              type="password"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Enter your Soniox API key"
            />
          </div>
        )}
        <p className="hint">
          Your API key is stored securely and used to authenticate with the Soniox speech-to-text service.
        </p>
      </div>
      {editing ? (
        <div className="password-input">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!newValue}
          >
            Save
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      ) : !hasKey ? (
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!newValue}
        >
          {saved ? 'Saved' : 'Save'}
        </button>
      ) : saved ? (
        <p className="hint">Saved</p>
      ) : null}
    </div>
  );
}
