import { useOverlay } from '../OverlayContext';
import { VolumeMeter } from './VolumeMeter';

const STATUS_TEXT: Record<string, string> = {
  idle: 'Idle',
  connecting: 'Connecting...',
  recording: 'Recording...',
  paused: 'Paused',
  finalizing: 'Finalizing...',
  error: 'Error',
  reconnecting: 'Reconnecting...',
};

export function StatusBar() {
  const { confirmingClear, paused, sessionStatus, error, audioLevelDb, requestClear, togglePauseResume, copyText } =
    useOverlay();

  const canTogglePause = sessionStatus === 'recording' || sessionStatus === 'paused';

  // Per spec: mic-denied shows "Microphone access denied" in status bar
  let statusText = STATUS_TEXT[sessionStatus] ?? 'Idle';
  if (sessionStatus === 'error' && error?.type === 'mic-denied') {
    statusText = 'Microphone access denied';
  }

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className="mic-icon">&#x1F3A4;</span>
        {sessionStatus === 'recording' && <VolumeMeter dB={audioLevelDb} />}
        <span className="status-text">{statusText}</span>
      </div>
      <div className="status-bar-right">
        <button onClick={togglePauseResume} disabled={!canTogglePause}>
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
