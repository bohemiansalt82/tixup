import { useState } from 'react';
import { useAuth, avatarFor } from '../../store/useAuth';
import { useSpaces } from '../../store/useSpaces';
import { InviteModal } from '../Modals/InviteModal';
import { canSendMail, sendInviteMail } from '../../utils/inviteMail';
import './TopBar.css';

const icon = (name) => `${import.meta.env.BASE_URL}images/header/${name}.svg`;

const VIEWS = [
  { id: 'list', icon: 'list_left', title: 'List view' },
  { id: 'timeline', icon: 'clock', title: 'Timeline view' },
  { id: 'calendar', icon: 'calendar', title: 'Calendar view (coming soon)', disabled: true },
];

/**
 * Top bar — Figma Tixup-V2.0 node 39519:9833.
 * Wired: title, view switcher, Tix count. Visual only for now:
 * Filter / Sort / Hide, member invite, overflow menus.
 */
export function TopBar({ title, currentView, onViewChange, taskCount = 0 }) {
  const user = useAuth();
  const { activeSpace, addMembers } = useSpaces();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [toast, setToast] = useState(null); // { kind: 'info'|'ok'|'error', text }
  const showToast = (kind, text, ms = 3200) => {
    setToast({ kind, text });
    if (ms) setTimeout(() => setToast(null), ms);
  };
  const members = activeSpace?.members ?? [];
  const shownMembers = members.slice(0, 4);
  const overflow = members.length - shownMembers.length;

  const handleInvite = async (emails, link) => {
    if (!activeSpace) return;
    addMembers(activeSpace.id, emails);
    setInviteOpen(false);

    if (canSendMail()) {
      showToast('info', `Sending ${emails.length} invite${emails.length > 1 ? 's' : ''}…`, 0);
      try {
        const res = await sendInviteMail({ to: emails, space: activeSpace, inviter: user, link });
        showToast('ok', `Invite sent to ${res.sent} ${res.sent > 1 ? 'people' : 'person'}.`);
      } catch (err) {
        console.error('Invite mail failed:', err);
        showToast('error', `Could not send: ${err.message}`, 6000);
      }
      return;
    }

    // No mail endpoint configured: hand the invite to the user's mail client.
    const subject = encodeURIComponent(`You're invited to "${activeSpace?.name ?? 'a space'}" on Tixup`);
    const body = encodeURIComponent(
      `${user?.name ?? 'A teammate'} invited you to the Tixup space "${activeSpace?.name ?? ''}".\n\nOpen this link to join:\n${link}\n\n— Tixup`,
    );
    window.location.href = `mailto:${emails.join(',')}?subject=${subject}&body=${body}`;
  };

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
