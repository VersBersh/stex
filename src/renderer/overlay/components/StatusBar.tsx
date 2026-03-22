import { useOverlay } from '../OverlayContext';

export function StatusBar() {
  const { confirmingClear, paused, requestClear, togglePauseResume, copyText } =
    useOverlay();

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className="mic-icon">&#x1F3A4;</span>
        <span className="status-text">Idle</span>
      </div>
      <div className="status-bar-right">
        <button onClick={togglePauseResume}>
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button
          onClick={requestClear}
          className={confirmingClear ? 'confirming' : undefined}
        >
          {confirmingClear ? 'Confirm?' : 'Clear'}
        </button>
        <button onClick={copyText}>Copy</button>
      </div>
    </div>
  );
}
