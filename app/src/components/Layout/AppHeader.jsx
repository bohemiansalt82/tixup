export function AppHeader({ title = 'My Project', currentView, onViewChange }) {
  return (
    <header className="tix-sticky-header">
      <div className="header-left">
        <div className="location-title">{title}</div>
        <div className="header-action-group">
          <button
            className={`icon-tool-btn${currentView === 'list' ? ' selected' : ''}`}
            onClick={() => onViewChange('list')}
          >
            <i className="icon icon-list" />
          </button>
          <button
            className={`icon-tool-btn${currentView === 'timeline' ? ' selected' : ''}`}
            onClick={() => onViewChange('timeline')}
          >
            <i className="icon icon-clock" />
          </button>
        </div>
      </div>
      <div className="header-right">
        <button className="btn-primary-tix" id="top-tix-btn">
          <i className="icon icon-add" style={{ backgroundColor: 'white' }} /> Tix
        </button>
      </div>
    </header>
  );
}
