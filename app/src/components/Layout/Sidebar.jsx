import { useAuth, logout, avatarFor } from '../../store/useAuth';

export function Sidebar() {
  const user = useAuth();

  const handleLogout = (e) => {
    e.stopPropagation();
    if (confirm('Sign out?')) logout();
  };

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
      {user && (
        <div className="nav-user-profile" id="nav-user-profile">
          <img
            className="nav-user-avatar"
            src={user.picture}
            alt={user.name}
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.src = avatarFor(user.name); }}
          />
          <div className="nav-user-info">
            <div className="nav-user-name">{user.name}</div>
            <div className="nav-user-email">{user.email}</div>
          </div>
          <button className="nav-logout-btn" title="Sign Out" onClick={handleLogout}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#999' }}>logout</span>
          </button>
        </div>
      )}
    </nav>
  );
}
