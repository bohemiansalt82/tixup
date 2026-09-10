import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './MakeModal.css';

const icon = (name) => `${import.meta.env.BASE_URL}images/gnb/${name}.svg`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COPY = {
  space: { title: 'Make a New Space', nameLabel: 'Space Name', icon: 'planet_32' },
  box: { title: 'Make a New Box', nameLabel: 'Box Name', icon: 'deployed_code_32' },
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
  const [draft, setDraft] = useState('');
  const nameRef = useRef(null);
  const tokenInputRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const commitDraft = () => {
    const value = draft.trim().replace(/,$/, '');
    if (!value) return;
    if (!members.some((m) => m.email === value)) {
      setMembers((prev) => [...prev, { email: value, valid: EMAIL_RE.test(value) }]);
    }
    setDraft('');
  };

  const onTokenKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      commitDraft();
    } else if (e.key === 'Backspace' && draft === '' && members.length) {
      setMembers((prev) => prev.slice(0, -1));
    }
  };

  const removeMember = (email) => setMembers((prev) => prev.filter((m) => m.email !== email));

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
            placeholder="Jy.choi"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </section>

        <section className="mk-section">
          <label className="mk-label" htmlFor="mk-invite">Invite Space Member</label>
          <div className="mk-token-input" onClick={() => tokenInputRef.current?.focus()}>
            {members.map((m) => (
              <span key={m.email} className={`mk-token${m.valid ? '' : ' invalid'}`}>
                {m.email}
                <button type="button" className="mk-token-remove" onClick={() => removeMember(m.email)} title="Remove">
                  <img src={icon(m.valid ? 'token_remove' : 'token_remove_white')} alt="" width={16} height={16} />
                </button>
              </span>
            ))}
            <input
              id="mk-invite"
              ref={tokenInputRef}
              className="mk-token-field"
              placeholder={members.length ? '' : 'abc@gmail.com'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onTokenKeyDown}
              onBlur={commitDraft}
              autoComplete="off"
            />
          </div>
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
