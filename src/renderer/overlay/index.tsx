import { createRoot } from 'react-dom/client';

function App() {
  return <div>stex overlay</div>;
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
