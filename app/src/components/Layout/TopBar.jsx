import { avatarFor } from '../../store/useAuth';
import { InviteModal } from '../Modals/InviteModal';
import { useInvite } from '../../hooks/useInvite';
import './TopBar.css';

const icon = (name) => `${import.meta.env.BASE_URL}images/header/${name}.svg`;

const VIEWS = [
  { id: 'list', icon: 'list_left', title: 'List view' },
  { id: 'timeline', icon: 'clock', title: 'Timeline view' },
  { id: 'calendar', icon: 'calendar', title: 'Calendar view' },
];

/**
 * Top bar — Figma Tixup-V2.0 "TopBar" component 39558:13539 (List page, Timeline View 37635:4541).
 * Wired: title, view switcher (Tab / Icon Group), Tix count, + Tix (create), member invite.
 * Visual only for now: Filter / Sort / Hide, overflow menus.
 */
export function TopBar({ title, currentView, onViewChange, taskCount = 0, onCreateTix }) {
  const { user, activeSpace, inviteOpen, setInviteOpen, toast, handleInvite } = useInvite();
  const members = activeSpace?.members ?? [];
  const shownMembers = members.slice(0, 4);
  const overflow = members.length - shownMembers.length;

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
              <span className="topbar-view-icon" style={{ '--icon': `url(${icon(v.icon)})` }} aria-hidden="true" />
            </button>
          ))}
          <button type="button" className="topbar-view-btn" title="View options (coming soon)">
            <span className="topbar-view-icon" style={{ '--icon': `url(${icon('more_vert')})` }} aria-hidden="true" />
          </button>
        </div>

        <div className="topbar-controls">
          {[['filter', 'Filter'], ['sort', 'Sort'], ['visibility_off', 'Hide']].map(([ic, label]) => (
            <button key={ic} type="button" className="topbar-control" title={`${label} (coming soon)`}>
              <img src={icon(ic)} alt="" width={18} height={18} />
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
          {shownMembers.map((email) => (
            <span key={email} className="topbar-avatar topbar-avatar-member" title={email}>
              <img src={avatarFor(email.split('@')[0])} alt={email} referrerPolicy="no-referrer" />
            </span>
          ))}
          {overflow > 0 && <span className="topbar-avatar topbar-avatar-more" title={members.slice(4).join(', ')}>{overflow > 9 ? '9+' : `+${overflow}`}</span>}
          <button type="button" className="topbar-avatar topbar-avatar-add" title="Invite member" onClick={() => setInviteOpen(true)} disabled={!activeSpace}>
            <img src={icon('add')} alt="" width={24} height={24} />
          </button>
        </div>

        <div className="topbar-count">
          <span className="topbar-count-value">{taskCount}</span>
          <span className="topbar-count-label">Tix</span>
        </div>

        {onCreateTix && (
          <button type="button" className="topbar-create" onClick={onCreateTix} title="Create Tix">
            <img src={icon('add_white')} alt="" width={22} height={22} />
            <span>Tix</span>
          </button>
        )}

        <button type="button" className="topbar-more" title="More (coming soon)">
          <img src={icon('more_vert_32')} alt="" width={32} height={32} />
        </button>
      </div>

      {toast && <div className={`topbar-toast ${toast.kind}`} role="status">{toast.text}</div>}

      {inviteOpen && activeSpace && (
        <InviteModal space={activeSpace} inviter={user} onClose={() => setInviteOpen(false)} onInvite={handleInvite} />
      )}
    </header>
  );
}
