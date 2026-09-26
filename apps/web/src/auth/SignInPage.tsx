import { useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { hashParam } from '../router';
import { Brand, Icon } from '../ui/Icon';

// The shared API client throws "<status> <statusText>: <body>".
function friendlyError(m: string): string {
  const code = m.slice(0, 3);
  if (code === '503') return 'Accounts are turned off on this server (no database). You can keep using medify.Rx as a guest.';
  if (code === '401') return 'That email and password do not match.';
  if (code === '409') return 'An account with that email already exists. Try signing in.';
  if (code === '400') return 'Please check your email address and password.';
  if (code === '429') return 'Too many attempts. Please wait a moment and try again.';
  return 'Could not reach the server. Please try again.';
}

type Mode = 'login' | 'register' | 'forgot' | 'reset';

const TITLES: Record<Mode, string> = {
  login: 'Welcome back',
  register: 'Create your account',
  forgot: 'Reset your password',
  reset: 'Choose a new password',
};

const SUBMIT: Record<Mode, string> = {
  login: 'Sign In',
  register: 'Create account',
  forgot: 'Send reset link',
  reset: 'Set new password',
};

interface Props {
  onSignedIn: (token: string, remember: boolean) => void;
  /** Present when the user arrived from a password-reset link. */
  resetToken?: string | null;
}

export function SignInPage({ onSignedIn, resetToken }: Props) {
  const [mode, setMode] = useState<Mode>(resetToken ? 'reset' : hashParam('mode') === 'forgot' ? 'forgot' : 'login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [remember, setRemember] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [sent, setSent] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setMsg(null);
    setSent(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const needsEmail = mode !== 'reset';
    const needsPassword = mode !== 'forgot';
    if ((needsEmail && !form.email) || (needsPassword && !form.password) || (mode === 'register' && !form.name)) {
      setMsg('Please fill in every field.');
      return;
    }
    if ((mode === 'reset' || mode === 'register') && form.password.length < 8) {
      setMsg('Please use at least 8 characters for your password.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'forgot') {
        await api.forgotPassword(form.email);
        setSent(true);
        setMsg('If an account uses that email, a reset link is on its way. It expires in 30 minutes.');
        return;
      }
      if (mode === 'reset') {
        if (!resetToken) throw new Error('400 missing token');
        const { token } = await api.resetPassword({ token: resetToken, password: form.password });
        onSignedIn(token, remember);
        return;
      }
      const { token } = mode === 'login' ? await api.login(form) : await api.register(form);
      onSignedIn(token, remember);
    } catch (err) {
      const m = (err as Error).message;
      setMsg(mode === 'reset' && m.startsWith('400') ? 'This reset link is invalid or has expired. Please request a new one.' : friendlyError(m));
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
          <h1>{TITLES[mode]}</h1>
          {mode === 'forgot' && (
            <p className="muted small" style={{ textAlign: 'center' }}>Enter your account email and we'll send you a link to choose a new password.</p>
          )}
          {mode === 'register' && (
            <div>
              <label htmlFor="name">Name</label>
              <div className="input"><input id="name" autoComplete="name" placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            </div>
          )}
          {mode !== 'reset' && (
            <div>
              <label htmlFor="user">Email</label>
              <div className="input"><input id="user" type="email" placeholder="you@example.com" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
          )}
          {mode !== 'forgot' && (
            <div>
              <label htmlFor="pass">{mode === 'reset' ? 'New password' : 'Password'}</label>
              <div className="input"><input id="pass" type="password" placeholder={mode === 'login' ? 'Enter password' : 'At least 8 characters'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            </div>
          )}
          {mode !== 'forgot' && (
          <div className="auth-row">
            <label className="check" htmlFor="remember" style={{ margin: 0, fontSize: 15 }}>
              <input type="checkbox" id="remember" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span className="box"><Icon name="check" /></span>Remember me
            </label>
            {mode === 'login' && <button type="button" className="text-btn" onClick={() => switchMode('forgot')}>Forgot password?</button>}
          </div>
          )}
          <button className="btn btn-ink" type="submit" disabled={busy || sent}>
            {busy ? 'One moment…' : sent ? 'Link sent' : SUBMIT[mode]}
          </button>
          <p className="auth-msg" aria-live="polite">{msg}</p>
          {mode === 'forgot' || mode === 'reset' ? (
            <p className="or">
              {mode === 'reset' ? 'Link not working? ' : 'Remembered it? '}
              <button type="button" className="text-btn" onClick={() => (mode === 'reset' ? (location.hash = '#signin?mode=forgot') : switchMode('login'))}>
                {mode === 'reset' ? 'Request a new one' : 'Back to sign in'}
              </button>
            </p>
          ) : (
          <>
          <p className="or">
            {mode === 'login' ? 'New here? ' : 'Already have an account? '}
            <button type="button" className="text-btn" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
          <p className="or">or sign in with</p>
          <div className="socials">
            <button type="button" className="icon-btn" aria-label="Sign in with Google" onClick={() => soon('Google sign-in')}>G</button>
            <button type="button" className="icon-btn" aria-label="Sign in with a passkey" onClick={() => soon('Passkey sign-in')}><Icon name="key" /></button>
            <button type="button" className="icon-btn" aria-label="Sign in with an email link" onClick={() => soon('Email link sign-in')}><Icon name="mail" /></button>
          </div>
          </>
          )}
          <p className="muted small" style={{ textAlign: 'center' }}>
            Your profile is only saved to your account when you choose to save it.
          </p>
        </form>
      </div>
    </section>
  );
}
