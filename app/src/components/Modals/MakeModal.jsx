import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TokenEmailInput } from './TokenEmailInput';
import './MakeModal.css';

const icon = (name) => `${import.meta.env.BASE_URL}images/gnb/${name}.svg`;

const COPY = {
  space: { title: 'Make a New Space', nameLabel: 'Space Name', namePlaceholder: 'Enter space name', icon: 'planet_32' },
  box: { title: 'Make a New Box', nameLabel: 'Box Name', namePlaceholder: 'Enter box name', icon: 'deployed_code_32' },
};

/**
 * "Make a New Space" / "Make a New Box" modal.
 * Figma: Tixup-V2.0 39521:11825 (space), 39523:13450 (box).
 * Invite tokens are UI only: they are saved as `members` but nothing is sent.
 */
export function MakeModal({ kind = 'space', onClose, onSave }) {
  const copy = COPY[kind];
  const [visibility, setVisibility] = useState('private');
  const [name, setName] = useState('');
  const [members, setMembers] = useState([]);
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const canSave = name.trim().length > 0;
  const handleSave = (e) => {
    e.preventDefault();
    if (!canSave) return;
    onSave({ name: name.trim(), visibility, members: members.map((m) => m.email) });
  };

  // Portal: the GNB uses backdrop-filter, which would otherwise trap position:fixed inside it.
  return createPortal(
    <div className="mk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="mk-panel" role="dialog" aria-modal="true" aria-labelledby="mk-title" onSubmit={handleSave}>
        <header className="mk-header">
          <img src={icon(copy.icon)} alt="" width={32} height={32} />
          <h2 id="mk-title" className="mk-title">{copy.title}</h2>
        </header>

        <div className="mk-top-actions">
          <button type="button" className="mk-icon-btn" title="More">
            <img src={icon('more_vert_32')} alt="" width={32} height={32} />
          </button>
          <button type="button" className="mk-icon-btn mk-close" title="Close" onClick={onClose}>
            <img src={icon('close_32')} alt="" width={32} height={32} />
          </button>
        </div>

        <div className="mk-tabs" role="tablist" aria-label="Visibility">
          {['private', 'public'].map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={visibility === v}
              className={`mk-tab${visibility === v ? ' active' : ''}`}
              onClick={() => setVisibility(v)}
            >
              {v === 'private' ? 'Private' : 'Public'}
            </button>
          ))}
        </div>

        <section className="mk-section">
          <label className="mk-label" htmlFor="mk-name">{copy.nameLabel}</label>
          <input
            id="mk-name"
            ref={nameRef}
            className="mk-input"
            placeholder={copy.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </section>

        <section className="mk-section">
          <label className="mk-label" htmlFor="mk-invite">Invite Space Member</label>
          <TokenEmailInput id="mk-invite" members={members} onChange={setMembers} placeholder="Enter email and press Enter" />
        </section>

        <footer className="mk-footer">
          <button type="button" className="mk-btn mk-btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="mk-btn mk-btn-primary" disabled={!canSave}>Save</button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
