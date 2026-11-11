import { useEffect, useRef, useState } from 'react';
import { avatarFor } from '../../store/useAuth';
import { rankMembers } from '../../utils/access';
import { InviteModal } from '../Modals/InviteModal';
import { useInvite } from '../../hooks/useInvite';
import './TopBar.css';

const icon = (name) => `${import.meta.env.BASE_URL}images/header/${name}.svg`;

const VIEWS = [
  { id: 'list', icon: 'list_left', title: 'List view' },
  { id: 'kanban', icon: 'view_kanban', title: 'Kanban board' },
  { id: 'timeline', icon: 'clock', title: 'Timeline view' },
  { id: 'calendar', icon: 'calendar', title: 'Calendar view' },
];

/**
 * Top bar — Figma Tixup-V2.0 "TopBar" component 39558:13539 (List page, Timeline View 37635:4541).
 * Wired: title, view switcher (Tab / Icon Group), Tix count, + Tix (create), member invite.
 * Visual only for now: Filter / Sort / Hide, overflow menus.
 */
export function TopBar({ title, members = [], ownerEmail = null, currentView, onViewChange, taskCount = 0, onCreateTix, readOnly = false, isOwner = true, onOpenAccess }) {
  const { user, activeSpace, inviteOpen, setInviteOpen, toast, handleInvite } = useInvite();
  // ⋮ (top right): permissions menu → Box 권한 popup (App renders it).
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  useEffect(() => {
    if (!moreOpen) return undefined;
    const onDown = (e) => { if (!moreRef.current?.contains(e.target)) setMoreOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [moreOpen]);
  // members: [{ email, name, picture, online }] from App (me + backend members + invited).
  // The crown goes on the space owner (from the backend), not on whoever is signed in.
  const ranked = rankMembers(members, user?.email, ownerEmail);
  const shownMembers = ranked.slice(0, 5);
  const overflowList = ranked.slice(5);
  const overflow = overflowList.length;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title" title={title}>{title}</h1>
        {readOnly && (
          <span className="topbar-readonly" title="이 Box는 보기 권한만 있어요">
            <span className="material-symbols-outlined" aria-hidden="true">visibility</span>
            보기 전용
          </span>
        )}

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
          {shownMembers.map((m, i) => {
            const name = m.isMe ? (user?.name || m.name) : (m.name || m.email.split('@')[0]);
            const picture = (m.isMe ? user?.picture : m.picture) || avatarFor(name);
            return (
              <span
                key={m.email}
                className={`topbar-avatar${i ? ' topbar-avatar-member' : ''}`}
                title={`${name}${m.isOwner ? ' (owner)' : ''}${m.isMe ? ' (나)' : ''}${m.online ? ' · online' : ''}`}
              >
                <img src={picture} alt={name} referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.src = avatarFor(name); }} />
                {m.isOwner && <img className="topbar-avatar-crown" src={icon('crown')} alt="" width={12} height={12} />}
                {m.online && <img className="topbar-avatar-online" src={icon('online')} alt="" width={10} height={10} title="Online" />}
              </span>
            );
          })}
          {overflow > 0 && <span className="topbar-avatar topbar-avatar-more" title={overflowList.map((m) => m.email).join(', ')}>{overflow > 9 ? '9+' : `+${overflow}`}</span>}
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

        <div className="topbar-more-wrap" ref={moreRef}>
          <button type="button" className={`topbar-more${moreOpen ? ' open' : ''}`} title="More" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
            <img src={icon('more_vert_32')} alt="" width={32} height={32} />
          </button>
          {moreOpen && (
            <div className="topbar-menu" role="menu">
              <div className="topbar-menu-label">권한</div>
              <button type="button" role="menuitem" className="topbar-menu-item" onClick={() => { setMoreOpen(false); onOpenAccess?.(); }}>
                <span className="material-symbols-outlined" aria-hidden="true">{isOwner ? 'admin_panel_settings' : 'badge'}</span>
                <span className="topbar-menu-text">
                  <span>{isOwner ? 'Box 권한 설정' : '내 Box 권한 보기'}</span>
                  <small>{isOwner ? '초대된 멤버의 보기 · 수정 권한' : '소유자가 정한 권한'}</small>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {toast && <div className={`topbar-toast ${toast.kind}`} role="status">{toast.text}</div>}

      {inviteOpen && activeSpace && (
        <InviteModal space={activeSpace} inviter={user} onClose={() => setInviteOpen(false)} onInvite={handleInvite} />
      )}
    </header>
  );
}
