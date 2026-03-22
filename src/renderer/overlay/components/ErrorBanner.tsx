import { useOverlay } from '../OverlayContext';

export function ErrorBanner() {
  const { error, dismissError, handleErrorAction } = useOverlay();

  if (!error) return null;

  return (
    <div className="error-banner">
      <span className="error-banner-message">{error.message}</span>
      <div className="error-banner-actions">
        {error.action && (
          <button className="error-banner-action" onClick={handleErrorAction}>
            {error.action.label}
          </button>
        )}
        <button className="error-banner-dismiss" onClick={dismissError} aria-label="Dismiss">
          &#x2715;
        </button>
      </div>
    </div>
  );
}
