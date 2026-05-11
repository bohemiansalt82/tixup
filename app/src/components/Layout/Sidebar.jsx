export function Sidebar() {
  return (
    <nav className="nav-sidebar">
      <header className="nav-header">
        <div className="nav-logo-container">
          <img src={`${import.meta.env.BASE_URL}images/icons/tixup_logo.svg`} alt="Tixup" className="nav-logo" />
        </div>
      </header>
      <div className="nav-section nav-section-spaces">
        <div className="nav-section-title-wrapper">
          <div className="nav-section-title-label">Space</div>
          <button className="nav-space-add-btn" title="New Space">
            <div className="nav-icon icon-add" />
          </button>
        </div>
        <div className="space-list" id="space-list" />
      </div>
      <div className="nav-sidebar-spacer" />
    </nav>
  );
}
