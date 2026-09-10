import { useState } from 'react';
import { demoLogin, finishLogin } from '../../store/useAuth';
import { AuthCard, AuthDivider, Field, GoogleButton } from './AuthShared';

export function Login() {
  const [form, setForm] = useState({ name: '', email: '' });
  const [error, setError] = useState('');
  const setField = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

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
      <GoogleButton onError={setError} />
      <AuthDivider />

      <Field label="Name" placeholder="jy.choi" value={form.name} onChange={setField('name')} autoComplete="name" />
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
