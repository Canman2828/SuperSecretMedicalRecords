import { useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { Brand, Icon } from '../ui/Icon';

// The shared API client throws "<status> <statusText>: <body>".
function friendlyError(m: string): string {
  const code = m.slice(0, 3);
  if (code === '503') return 'Accounts are turned off on this server (no database). You can keep using medify.Rx as a guest.';
  if (code === '401') return 'That email and password do not match.';
  if (code === '409') return 'An account with that email already exists. Try signing in.';
  if (code === '400') return 'Please check your email address and password.';
  return 'Could not reach the server. Please try again.';
}

interface Props {
  onSignedIn: (token: string, remember: boolean) => void;
}

export function SignInPage({ onSignedIn }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [remember, setRemember] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || (mode === 'register' && !form.name)) {
      setMsg('Please fill in every field.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const { token } = mode === 'login' ? await api.login(form) : await api.register(form);
      onSignedIn(token, remember);
    } catch (err) {
      setMsg(friendlyError((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const soon = (what: string) => setMsg(`${what} is not available yet.`);

  return (
    <section className="page">
      <div className="auth">
        <form className="auth-card" onSubmit={submit} noValidate>
          <Brand />
          <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          {mode === 'register' && (
            <div>
              <label htmlFor="name">Name</label>
              <div className="input"><input id="name" autoComplete="name" placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            </div>
          )}
          <div>
            <label htmlFor="user">Email</label>
            <div className="input"><input id="user" type="email" placeholder="you@example.com" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div>
            <label htmlFor="pass">Password</label>
            <div className="input"><input id="pass" type="password" placeholder="Enter password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          </div>
          <div className="auth-row">
            <label className="check" htmlFor="remember" style={{ margin: 0, fontSize: 15 }}>
              <input type="checkbox" id="remember" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span className="box"><Icon name="check" /></span>Remember me
            </label>
            {mode === 'login' && <button type="button" className="text-btn" onClick={() => soon('Password reset')}>Forgot password?</button>}
          </div>
          <button className="btn btn-ink" type="submit" disabled={busy}>
            {busy ? 'One moment…' : mode === 'login' ? 'Sign In' : 'Create account'}
          </button>
          <p className="auth-msg" aria-live="polite">{msg}</p>
          <p className="or">
            {mode === 'login' ? 'New here? ' : 'Already have an account? '}
            <button type="button" className="text-btn" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMsg(null); }}>
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
          <p className="or">or sign in with</p>
          <div className="socials">
            <button type="button" className="icon-btn" aria-label="Sign in with Google" onClick={() => soon('Google sign-in')}>G</button>
            <button type="button" className="icon-btn" aria-label="Sign in with a passkey" onClick={() => soon('Passkey sign-in')}><Icon name="key" /></button>
            <button type="button" className="icon-btn" aria-label="Sign in with an email link" onClick={() => soon('Email link sign-in')}><Icon name="mail" /></button>
          </div>
          <p className="muted small" style={{ textAlign: 'center' }}>
            Your profile is only saved to your account when you choose to save it.
          </p>
        </form>
      </div>
    </section>
  );
}
