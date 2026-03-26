import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import type { AppSettings } from '../../shared/types';
import { ApiKey } from './pages/ApiKey';
import { Hotkeys } from './pages/Hotkeys';
import { General } from './pages/General';
import './settings.css';

function initTheme() {
  window.settingsApi.getResolvedTheme().then((theme) => {
    document.documentElement.setAttribute('data-theme', theme);
  });
  window.settingsApi.onThemeChanged((theme) => {
    document.documentElement.setAttribute('data-theme', theme);
  });
}

initTheme();

type TabId = 'api-key' | 'hotkeys' | 'general';

const TABS: { id: TabId; label: string }[] = [
  { id: 'api-key', label: 'API Key' },
  { id: 'hotkeys', label: 'Hotkeys' },
  { id: 'general', label: 'General' },
];

function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [audioDevices, setAudioDevices] = useState<string[]>([]);
  const [micLabelsUnavailable, setMicLabelsUnavailable] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('api-key');

  useEffect(() => {
    window.settingsApi.getSettings().then(setSettings);
    window.settingsApi.getAudioDevices().then((result) => {
      setAudioDevices(result.devices);
      setMicLabelsUnavailable(result.labelsUnavailable);
    });

    const unsubscribe = window.settingsApi.onSettingsUpdated((updated) => {
      setSettings(updated);
    });

    const handleFocus = () => {
      window.settingsApi.getAudioDevices().then((result) => {
        setAudioDevices(result.devices);
        setMicLabelsUnavailable(result.labelsUnavailable);
      });
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleSettingChange = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      // Don't optimistically set sonioxApiKey — the IPC broadcast will
      // provide the masked value. Setting it here would briefly expose
      // the plaintext key in React state.
      if (key !== 'sonioxApiKey') {
        setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
      }
      window.settingsApi.setSetting(key, value);
    },
    [],
  );

  if (!settings) {
    return <div className="loading">Loading settings...</div>;
  }

  return (
    <div className="settings-layout">
      <nav className="settings-sidebar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <main className="settings-content">
        {activeTab === 'api-key' && (
          <ApiKey settings={settings} onSettingChange={handleSettingChange} />
        )}
        {activeTab === 'hotkeys' && (
          <Hotkeys settings={settings} onSettingChange={handleSettingChange} />
        )}
        {activeTab === 'general' && (
          <General
            settings={settings}
            onSettingChange={handleSettingChange}
            audioDevices={audioDevices}
            micLabelsUnavailable={micLabelsUnavailable}
          />
        )}
      </main>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
