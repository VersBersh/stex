import React, { useState, useEffect, useCallback } from 'react';
import type { AppSettings } from '../../../shared/types';

interface Props {
  settings: AppSettings;
  onSettingChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  audioDevices: string[];
}

export function General({ settings, onSettingChange, audioDevices }: Props) {
  const [logPath, setLogPath] = useState<string | null>(null);

  useEffect(() => {
    window.settingsApi.getLogPath().then(setLogPath);
  }, []);

  const handleRevealLog = useCallback(() => {
    window.settingsApi.revealLogFile();
  }, []);

  return (
    <div>
      <h2>General</h2>

      <div className="setting-group">
        <label htmlFor="theme">Theme</label>
        <select
          id="theme"
          value={settings.theme}
          onChange={(e) => onSettingChange('theme', e.target.value as AppSettings['theme'])}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>

      <div className="setting-group">
        <label htmlFor="on-show">On Show Behavior</label>
        <select
          id="on-show"
          value={settings.onShow}
          onChange={(e) => onSettingChange('onShow', e.target.value as AppSettings['onShow'])}
        >
          <option value="fresh">Fresh (clear editor)</option>
          <option value="append">Append (keep previous text)</option>
        </select>
        <p className="hint">Controls what happens to the editor when the overlay appears.</p>
      </div>

      <div className="setting-group">
        <label htmlFor="on-hide">On Hide Behavior</label>
        <select
          id="on-hide"
          value={settings.onHide}
          onChange={(e) => onSettingChange('onHide', e.target.value as AppSettings['onHide'])}
        >
          <option value="clipboard">Copy to clipboard</option>
          <option value="none">Do nothing</option>
        </select>
        <p className="hint">Controls what happens to the transcribed text when the overlay hides.</p>
      </div>

      <div className="setting-group">
        <div className="checkbox-row">
          <input
            id="launch-startup"
            type="checkbox"
            checked={settings.launchOnStartup}
            onChange={(e) => onSettingChange('launchOnStartup', e.target.checked)}
          />
          <label htmlFor="launch-startup">Launch on startup</label>
        </div>
      </div>

      <div className="setting-group">
        <label htmlFor="audio-device">Audio Input Device</label>
        <select
          id="audio-device"
          value={settings.audioInputDevice ?? ''}
          onChange={(e) =>
            onSettingChange('audioInputDevice', e.target.value || null)
          }
        >
          <option value="">System Default</option>
          {audioDevices.map((device) => (
            <option key={device} value={device}>
              {device}
            </option>
          ))}
        </select>
      </div>

      <div className="setting-group">
        <label htmlFor="soniox-model">Soniox Model</label>
        <input
          id="soniox-model"
          type="text"
          value={settings.sonioxModel}
          onChange={(e) => onSettingChange('sonioxModel', e.target.value)}
        />
      </div>

      <div className="setting-group">
        <label htmlFor="language">Language</label>
        <input
          id="language"
          type="text"
          value={settings.language}
          onChange={(e) => onSettingChange('language', e.target.value)}
        />
        <p className="hint">Language hint for Soniox (e.g. "en", "es", "fr").</p>
      </div>

      <div className="setting-group">
        <label htmlFor="max-endpoint-delay">
          Max Endpoint Delay
          <span className="range-value">{settings.maxEndpointDelayMs}ms</span>
        </label>
        <input
          id="max-endpoint-delay"
          type="range"
          min={500}
          max={3000}
          step={100}
          value={settings.maxEndpointDelayMs}
          onChange={(e) =>
            onSettingChange('maxEndpointDelayMs', Number(e.target.value))
          }
        />
        <p className="hint">
          Controls how quickly speech is finalized. Lower values finalize faster but may split words.
        </p>
      </div>
      <div className="setting-group">
        <label>Log File</label>
        <div className="log-path-row">
          <code className="log-path">{logPath ?? 'Not available'}</code>
          <button type="button" className="btn" onClick={handleRevealLog} disabled={!logPath}>
            Show in folder
          </button>
        </div>
        <p className="hint">Application log file for troubleshooting.</p>
      </div>
    </div>
  );
}
