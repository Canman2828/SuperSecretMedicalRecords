import { useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { Brand, Icon } from '../ui/Icon';

const SECURITY_QUESTION = 'Who is your favorite cousin?';

// The shared API client throws "<status> <statusText>: <body>".
function friendlyError(m: string, mode: Mode): string {
  const code = m.slice(0, 3);
  if (code === '503') return 'Accounts are turned off on this server (no database). You can keep using medify.Rx as a guest.';
  if (code === '401') return mode === 'forgot' ? 'That email and answer do not match.' : 'That email and password do not match.';
  if (code === '409') return 'An account with that email already exists. Try signing in.';
  if (code === '400') return 'Please check your email address and password.';
  if (code === '429') return 'Too many wrong answers. Please wait 15 minutes and try again.';
  return 'Could not reach the server. Please try again.';
}

type Mode = 'login' | 'register' | 'forgot';

const TITLES: Record<Mode, string> = {
  login: 'Welcome back',
  register: 'Create your account',
  forgot: 'Reset your password',
};

const SUBMIT: Record<Mode, string> = {
  login: 'Sign In',
  register: 'Create account',
  forgot: 'Reset password',
};

interface Props {
  onSignedIn: (token: string, remember: boolean) => void;
}

export function SignInPage({ onSignedIn }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', securityAnswer: '' });
  const [remember, setRemember] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setMsg(null);
    setForm((f) => ({ ...f, password: '', securityAnswer: '' }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const needsAnswer = mode !== 'login';
    if (!form.email || !form.password || (mode === 'register' && !form.name) || (needsAnswer && !form.securityAnswer.trim())) {
      setMsg('Please fill in every field.');
      return;
    }
    if (mode !== 'login' && form.password.length < 8) {
      setMsg('Please use at least 8 characters for your password.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const { token } =
        mode === 'login'
          ? await api.login(form)
          : mode === 'register'
            ? await api.register(form)
            : await api.resetPassword(form);
      onSignedIn(token, remember);
    } catch (err) {
      setMsg(friendlyError((err as Error).message, mode));
    } finally {
      setBusy(false);
    }
  };

  const answerField = (
    <div>
      <label htmlFor="answer">{SECURITY_QUESTION}</label>
      <div className="input">
        <input id="answer" autoComplete="off" placeholder="Their first name" maxLength={100} value={form.securityAnswer} onChange={(e) => setForm({ ...form, securityAnswer: e.target.value })} />
      </div>
      {mode === 'register' && (
        <p className="muted small" style={{ marginTop: 8 }}>You'll answer this if you ever forget your password. Capital letters don't matter.</p>
      )}
    </div>
  );

  return (
    <section className="page">
      <div className="auth">
        <form className="auth-card" onSubmit={submit} noValidate>
          <Brand />
          <h1>{TITLES[mode]}</h1>
          {mode === 'forgot' && (
            <p className="muted small" style={{ textAlign: 'center' }}>Answer your security question and choose a new password.</p>
          )}
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
          {mode === 'forgot' && answerField}
          <div>
            <label htmlFor="pass">{mode === 'forgot' ? 'New password' : 'Password'}</label>
            <div className="input"><input id="pass" type="password" placeholder={mode === 'login' ? 'Enter password' : 'At least 8 characters'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          </div>
          {mode === 'register' && answerField}
          <div className="auth-row">
            <label className="check" htmlFor="remember" style={{ margin: 0, fontSize: 15 }}>
              <input type="checkbox" id="remember" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span className="box"><Icon name="check" /></span>Remember me
            </label>
            {mode === 'login' && <button type="button" className="text-btn" onClick={() => switchMode('forgot')}>Forgot password?</button>}
          </div>
          <button className="btn btn-ink" type="submit" disabled={busy}>
            {busy ? 'One moment…' : SUBMIT[mode]}
          </button>
          <p className="auth-msg" aria-live="polite">{msg}</p>
          {mode === 'forgot' ? (
            <p className="or">
              Remembered it?{' '}
              <button type="button" className="text-btn" onClick={() => switchMode('login')}>Back to sign in</button>
            </p>
          ) : (
            <p className="or">
              {mode === 'login' ? 'New here? ' : 'Already have an account? '}
              <button type="button" className="text-btn" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
                {mode === 'login' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          )}
          <p className="muted small" style={{ textAlign: 'center' }}>
            Your profile is only saved to your account when you choose to save it.
          </p>
        </form>
      </div>
    </section>
  );
}
