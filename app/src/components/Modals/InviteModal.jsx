import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { TokenEmailInput } from './TokenEmailInput';
import { buildInviteLink } from '../../store/invites';
import './MakeModal.css';
import './InviteModal.css';

const icon = (name) => `${import.meta.env.BASE_URL}images/gnb/${name}.svg`;

/**
 * "Invite Friends" modal — Figma Tixup-V2.0 39528:14464 (default / tokens / invalid).
 * - Enter turns an email into a token; invalid formats render red and block Invite.
 * - Copy Link copies an invite URL anyone can open to join the space.
 * - Invite records members on the space and opens the mail client with the invite.
 */
export function InviteModal({ space, inviter, onClose, onInvite }) {
  const [members, setMembers] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const link = buildInviteLink(space, inviter);
  const hasInvalid = members.some((m) => !m.valid);
  const canInvite = members.length > 0 && !hasInvalid;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt('Copy this invite link', link);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleInvite = (e) => {
    e.preventDefault();
    if (!canInvite) return;
    onInvite(members.map((m) => m.email), link);
  };

  return createPortal(
    <div className="inv-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="inv-panel" role="dialog" aria-modal="true" aria-labelledby="inv-title" onSubmit={handleInvite}>
        <header className="mk-header">
          <img src={icon('send_32')} alt="" width={32} height={32} />
          <h2 id="inv-title" className="mk-title">Invite Friends</h2>
        </header>

        <div className="mk-top-actions">
          <button type="button" className="mk-icon-btn" title="More">
            <img src={icon('more_vert_32')} alt="" width={32} height={32} />
          </button>
          <button type="button" className="mk-icon-btn mk-close" title="Close" onClick={onClose}>
            <img src={icon('close_32')} alt="" width={32} height={32} />
          </button>
        </div>

        <section className="mk-section">
          <label className="mk-label" htmlFor="inv-emails">Invite Space Member</label>
          <TokenEmailInput id="inv-emails" members={members} onChange={setMembers} placeholder="enter email address" autoFocus />
          {hasInvalid && <p className="inv-hint" role="alert">Red tokens are not valid email addresses. Remove or fix them to continue.</p>}
        </section>

        <footer className="inv-footer">
          <button type="button" className="inv-copy" onClick={copyLink} title={link}>
            <img src={icon('link_16')} alt="" width={16} height={16} />
            <span>{copied ? 'Link copied!' : 'Copy Link'}</span>
          </button>
          <div className="inv-actions">
            <button type="button" className="mk-btn mk-btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="mk-btn mk-btn-primary" disabled={!canInvite}>Invite</button>
          </div>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
