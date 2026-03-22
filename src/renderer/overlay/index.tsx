import { createRoot } from 'react-dom/client';
import { TitleBar } from './components/TitleBar';
import { Editor } from './editor/Editor';
import { ErrorBanner } from './components/ErrorBanner';
import { StatusBar } from './components/StatusBar';
import { OverlayProvider } from './OverlayContext';
import './overlay.css';

function initTheme() {
  window.api.getResolvedTheme().then((theme) => {
    document.documentElement.setAttribute('data-theme', theme);
  });
  window.api.onThemeChanged((theme) => {
    document.documentElement.setAttribute('data-theme', theme);
  });
}

initTheme();

function App() {
  return (
    <OverlayProvider>
      <div className="overlay-app">
        <TitleBar />
        <Editor />
        <ErrorBanner />
        <StatusBar />
      </div>
    </OverlayProvider>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
