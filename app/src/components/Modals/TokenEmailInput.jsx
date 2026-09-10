import { useRef, useState } from 'react';
import './MakeModal.css';

const icon = (name) => `${import.meta.env.BASE_URL}images/gnb/${name}.svg`;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email token input (Figma "Token Input"). Enter / comma / space / blur turns the
 * draft into a token; tokens that are not valid emails render red.
 * `members` is [{ email, valid }].
 */
export function TokenEmailInput({ id, members, onChange, placeholder = 'enter email address', autoFocus = false }) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  const commit = () => {
    const value = draft.trim().replace(/[,;]$/, '');
    if (!value) return;
    if (!members.some((m) => m.email === value)) {
      onChange([...members, { email: value, valid: EMAIL_RE.test(value) }]);
    }
    setDraft('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && draft === '' && members.length) {
      onChange(members.slice(0, -1));
    }
  };

  const onPaste = (e) => {
    const text = e.clipboardData?.getData('text') ?? '';
    if (!/[,\s;]/.test(text)) return;
    e.preventDefault();
    const next = [...members];
    text.split(/[,\s;]+/).map((s) => s.trim()).filter(Boolean).forEach((email) => {
      if (!next.some((m) => m.email === email)) next.push({ email, valid: EMAIL_RE.test(email) });
    });
    onChange(next);
  };

  return (
    <div className="mk-token-input" onClick={() => inputRef.current?.focus()}>
      {members.map((m) => (
        <span key={m.email} className={`mk-token${m.valid ? '' : ' invalid'}`} title={m.valid ? m.email : `${m.email} — not a valid email`}>
          {m.email}
          <button type="button" className="mk-token-remove" onClick={() => onChange(members.filter((x) => x.email !== m.email))} title="Remove">
            <img src={icon(m.valid ? 'token_remove' : 'token_remove_white')} alt="" width={16} height={16} />
          </button>
        </span>
      ))}
      <input
        id={id}
        ref={inputRef}
        className="mk-token-field"
        placeholder={members.length ? '' : placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={commit}
        autoComplete="off"
        autoFocus={autoFocus}
      />
    </div>
  );
}
