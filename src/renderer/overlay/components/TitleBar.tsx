export function TitleBar() {
  const handleHide = () => {
    window.api.hideWindow();
  };

  return (
    <div className="title-bar">
      <div className="title-bar-drag" />
      <button className="title-bar-btn" onClick={handleHide} aria-label="Hide">
        &#x2715;
      </button>
    </div>
  );
}
