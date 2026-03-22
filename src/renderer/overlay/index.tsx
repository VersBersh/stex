import { createRoot } from 'react-dom/client';
import { TitleBar } from './components/TitleBar';
import { Editor } from './editor/Editor';
import { StatusBar } from './components/StatusBar';
import { OverlayProvider } from './OverlayContext';
import './overlay.css';

function App() {
  return (
    <OverlayProvider>
      <div className="overlay-app">
        <TitleBar />
        <Editor />
        <StatusBar />
      </div>
    </OverlayProvider>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
