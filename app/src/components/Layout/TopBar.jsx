import { useAuth, avatarFor } from '../../store/useAuth';
import './TopBar.css';

const icon = (name) => `${import.meta.env.BASE_URL}images/header/${name}.svg`;

const VIEWS = [
  { id: 'list', icon: 'list_left', title: 'List view' },
  { id: 'timeline', icon: 'clock', title: 'Timeline view' },
  { id: 'calendar', icon: 'calendar', title: 'Calendar view (coming soon)', disabled: true },
];

/**
 * Top bar — Figma Tixup-V2.0 node 39519:9833.
 * Wired: title, view switcher, Tix count, Create Tix. Visual only for now:
 * Filter / Sort / Hide, member invite, overflow menus.
 */
export function TopBar({ title, currentView, onViewChange, taskCount = 0, onCreateTix }) {
  const user = useAuth();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title" title={title}>{title}</h1>

        <div className="topbar-views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`topbar-view-btn${currentView === v.id ? ' active' : ''}`}
              title={v.title}
              aria-pressed={currentView === v.id}
              disabled={v.disabled}
              onClick={() => !v.disabled && onViewChange(v.id)}
            >
              <img src={icon(v.icon)} alt="" width={24} height={24} />
            </button>
          ))}
          <button type="button" className="topbar-plain-btn" title="View options (coming soon)">
            <img src={icon('more_vert')} alt="" width={24} height={24} />
          </button>
        </div>

        <div className="topbar-controls">
          {[['filter', 'Filter'], ['sort', 'Sort'], ['visibility_off', 'Hide']].map(([ic, label]) => (
            <button key={ic} type="button" className="topbar-control" title={`${label} (coming soon)`}>
              <img src={icon(ic)} alt="" width={20} height={20} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="topbar-right">
        <div className="topbar-members">
          {user && (
            <span className="topbar-avatar" title={`${user.name} (owner)`}>
              <img
                src={user.picture || avatarFor(user.name)}
                alt={user.name}
                referrerPolicy="no-referrer"
                onError={(e) => { e.currentTarget.src = avatarFor(user.name); }}
              />
              <img className="topbar-avatar-crown" src={icon('crown')} alt="" width={12} height={12} />
            </span>
          )}
          <button type="button" className="topbar-avatar topbar-avatar-add" title="Invite member (coming soon)">
            <img src={icon('add')} alt="" width={24} height={24} />
          </button>
        </div>

        <div className="topbar-count">
          <span className="topbar-count-value">{taskCount}</span>
          <span className="topbar-count-label">Tix</span>
        </div>

        <button type="button" className="topbar-primary" onClick={onCreateTix}>
          <img src={icon('add_circle_white')} alt="" width={24} height={24} />
          <span>Tix</span>
        </button>

        <button type="button" className="topbar-more" title="More (coming soon)">
          <img src={icon('more_vert_32')} alt="" width={32} height={32} />
        </button>
      </div>
    </header>
  );
}
