import { useEffect, useState } from 'react';
import { demoLogin, finishLogin } from '../../store/useAuth';
import { AuthCard, AuthDivider, Field, GoogleButton } from './AuthShared';
import { parseInviteHash, peekPendingInvite, resolveInvite } from '../../store/invites';

export function Login() {
  const [form, setForm] = useState({ name: '', email: '' });
  const [error, setError] = useState('');
  const setField = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));
  // Arrived through an invite link: say whose space they are joining. On the very first
  // render the link is still in the hash (App stashes it in an effect), so check both.
  // Short links carry only the id; the name / inviter are fetched from the backend.
  const pending = peekPendingInvite() || parseInviteHash(window.location.hash);
  const [invite, setInvite] = useState(pending);
  useEffect(() => {
    if (!pending) return;
    let alive = true;
    resolveInvite(pending).then((r) => { if (alive && r) setInvite(r); });
    return () => { alive = false; };
  }, [pending?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim();
    if (!name || !email.includes('@')) {
      setError('이름과 올바른 이메일을 입력해 주세요.');
      return;
    }
    finishLogin(demoLogin(name, email));
  };

  return (
    <AuthCard onSubmit={handleSubmit}>
      {invite && (
        <div className="signup-invite" role="status">
          <span className="signup-invite-title">
            {invite.name
              ? <><strong>{invite.by?.name || 'A teammate'}</strong> invited you to <strong>“{invite.name}”</strong></>
              : <>You’ve been invited to a Tixup space</>}
          </span>
          <span className="signup-invite-desc">Sign in with Google to join the space.</span>
        </div>
      )}
      <GoogleButton onError={setError} />
      <AuthDivider />

      <Field label="Name" placeholder="Enter your name" value={form.name} onChange={setField('name')} autoComplete="name" />
      <Field label="Email" type="email" placeholder="Enter your email" value={form.email} onChange={setField('email')} autoComplete="email" />

      {error && <p className="signup-error" role="alert">{error}</p>}

      <button type="submit" className="signup-submit">Sign in</button>

      <div className="signup-footer">
        <span className="signup-footer-muted">Don't have an account?</span>
        <a className="signup-footer-link" href="#signup">Create account</a>
      </div>
    </AuthCard>
  );
}
