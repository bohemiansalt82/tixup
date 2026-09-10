import { useState } from 'react';
import './SignUp.css';

const GoogleIcon = () => (
  <svg className="signup-google-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path fill="#4285F4" d="M15.68 8.18c0-.57-.05-1.11-.15-1.64H8v3.1h4.3a3.68 3.68 0 0 1-1.6 2.42v2h2.58c1.51-1.39 2.4-3.44 2.4-5.88Z" />
    <path fill="#34A853" d="M8 16c2.16 0 3.97-.72 5.29-1.94l-2.58-2c-.72.48-1.64.76-2.71.76-2.08 0-3.85-1.4-4.48-3.3H.85v2.07A8 8 0 0 0 8 16Z" />
    <path fill="#FBBC05" d="M3.52 9.52A4.8 4.8 0 0 1 3.26 8c0-.53.09-1.04.26-1.52V4.41H.85A8 8 0 0 0 0 8c0 1.29.31 2.5.85 3.59l2.67-2.07Z" />
    <path fill="#EA4335" d="M8 3.18c1.17 0 2.23.4 3.06 1.2l2.29-2.3A7.65 7.65 0 0 0 8 0 8 8 0 0 0 .85 4.41l2.67 2.07C4.15 4.58 5.92 3.18 8 3.18Z" />
  </svg>
);

const Field = ({ label, type = 'text', placeholder, value, onChange, autoComplete }) => (
  <div className="signup-field">
    <label className="signup-label">
      {label}
      <span className="signup-label-bullet" />
    </label>
    <input
      className="signup-input"
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
    />
  </div>
);

const CLIENTS = [
  { src: import.meta.env.BASE_URL + 'images/samsung.svg', alt: 'Samsung' },
  { src: import.meta.env.BASE_URL + 'images/kakaopay.svg', alt: 'KakaoPay' },
  { src: import.meta.env.BASE_URL + 'images/cgv.svg', alt: 'CGV' },
  { src: import.meta.env.BASE_URL + 'images/hanabank.svg', alt: 'Hana Bank' },
];

export function SignUp() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const setField = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: wire up to auth backend
    console.log('Create account', form);
  };

  return (
    <div className="signup-root">
      <div className="signup-card">
        {/* Left: form panel */}
        <form className="signup-panel" onSubmit={handleSubmit}>
          <div className="signup-brand">
            <img src={`${import.meta.env.BASE_URL}images/icons/tixup_logo.svg`} alt="" className="signup-brand-mark" />
            <img src={`${import.meta.env.BASE_URL}images/icons/tix.svg`} alt="Tixup" className="signup-brand-wordmark" />
          </div>

          <button type="button" className="signup-google-btn">
            <GoogleIcon />
            <span>Sign in with Google</span>
          </button>

          <div className="signup-divider">
            <span className="signup-divider-line" />
            <span className="signup-divider-text">Or</span>
            <span className="signup-divider-line" />
          </div>

          <Field
            label="Name"
            placeholder="jy.choi"
            value={form.name}
            onChange={setField('name')}
            autoComplete="name"
          />
          <Field
            label="Email"
            type="email"
            placeholder="Enter your email"
            value={form.email}
            onChange={setField('email')}
            autoComplete="email"
          />
          <Field
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={form.password}
            onChange={setField('password')}
            autoComplete="new-password"
          />

          <button type="submit" className="signup-submit">Create Account</button>

          <div className="signup-footer">
            <span className="signup-footer-muted">Already have an account?</span>
            <a className="signup-footer-link" href="#login">Sign in</a>
          </div>
        </form>

        {/* Right: hero panel */}
        <aside className="signup-hero">
          <div className="signup-hero-copy">
            <h2 className="signup-hero-title">Secured Task Management</h2>
            <p className="signup-hero-desc">
              "Tix" means "Ticket" and refers to<br />a single unit of task
            </p>
          </div>

          <div className="signup-clients">
            <span className="signup-clients-label">Our Clients</span>
            <div className="signup-clients-logos">
              {CLIENTS.map((c) => (
                <img key={c.alt} src={c.src} alt={c.alt} className="signup-client-logo" />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
