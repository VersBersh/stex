import React, { useState, useEffect, useRef } from 'react';
import type { AppSettings } from '../../../shared/types';

interface Props {
  settings: AppSettings;
  onSettingChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export function ApiKey({ settings, onSettingChange }: Props) {
  const [value, setValue] = useState(settings.sonioxApiKey);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const isEditing = useRef(false);

  useEffect(() => {
    if (!isEditing.current) {
      setValue(settings.sonioxApiKey);
    }
  }, [settings.sonioxApiKey]);

  const handleSave = () => {
    onSettingChange('sonioxApiKey', value);
    isEditing.current = false;
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h2>API Key</h2>
      <div className="setting-group">
        <label htmlFor="api-key">Soniox API Key</label>
        <div className="password-input">
          <input
            id="api-key"
            type={showKey ? 'text' : 'password'}
            value={value}
            onChange={(e) => {
              isEditing.current = true;
              setValue(e.target.value);
              setSaved(false);
            }}
            placeholder="Enter your Soniox API key"
          />
          <button
            type="button"
            className="btn"
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="hint">
          Your API key is stored locally and used to authenticate with the Soniox speech-to-text service.
        </p>
      </div>
      <button
        type="button"
        className="btn btn-primary"
        onClick={handleSave}
        disabled={value === settings.sonioxApiKey}
      >
        {saved ? 'Saved' : 'Save'}
      </button>
    </div>
  );
}
