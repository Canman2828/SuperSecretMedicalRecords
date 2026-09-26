import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../src/api';
import { useAuth } from '../src/auth/AuthContext';
import { Brand } from '../src/ui/Icon';
import { Btn, Check, Field, IconBtn, Muted, Screen } from '../src/ui/kit';
import { C, F } from '../src/ui/theme';

// Mirrors apps/web/src/auth/SignInPage.tsx.

const SECURITY_QUESTION = 'Who is your favorite cousin?';

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

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
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

  const submit = async () => {
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
      await signIn(token, remember);
      router.back();
      router.navigate('/prescriptive');
    } catch (err) {
      setMsg(friendlyError((err as Error).message, mode));
    } finally {
      setBusy(false);
    }
  };

  const answerField = (
    <View>
      <Text style={styles.label}>{SECURITY_QUESTION}</Text>
      <Field
        autoComplete="off"
        autoCapitalize="none"
        placeholder="Their first name"
        maxLength={100}
        value={form.securityAnswer}
        onChangeText={(securityAnswer) => setForm({ ...form, securityAnswer })}
        style={styles.input}
        accessibilityLabel={SECURITY_QUESTION}
      />
      {mode === 'register' && (
        <Muted small style={{ marginTop: 8 }}>You&apos;ll answer this if you ever forget your password. Capital letters don&apos;t matter.</Muted>
      )}
    </View>
  );

  return (
    <Screen top={false}>
      <View style={styles.close}>
        <IconBtn icon="x" label="Close" size={40} onPress={() => router.back()} />
      </View>
      <View style={styles.card}>
        <View style={{ alignItems: 'center' }}><Brand /></View>
        <Text style={styles.h1} accessibilityRole="header">{TITLES[mode]}</Text>
        {mode === 'forgot' && (
          <Muted small style={{ textAlign: 'center' }}>Answer your security question and choose a new password.</Muted>
        )}

        {mode === 'register' && (
          <View>
            <Text style={styles.label}>Name</Text>
            <Field autoComplete="name" textContentType="name" placeholder="Your name" value={form.name} onChangeText={(name) => setForm({ ...form, name })} style={styles.input} accessibilityLabel="Name" />
          </View>
        )}
        <View>
          <Text style={styles.label}>Email</Text>
          <Field
            autoComplete="email"
            textContentType="username"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="you@example.com"
            value={form.email}
            onChangeText={(email) => setForm({ ...form, email })}
            style={styles.input}
            accessibilityLabel="Email"
          />
        </View>

        {mode === 'forgot' && answerField}

        <View>
          <Text style={styles.label}>{mode === 'forgot' ? 'New password' : 'Password'}</Text>
          <Field
            secureTextEntry
            textContentType={mode === 'login' ? 'password' : 'newPassword'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={mode === 'login' ? 'Enter password' : 'At least 8 characters'}
            value={form.password}
            onChangeText={(password) => setForm({ ...form, password })}
            onSubmitEditing={submit}
            returnKeyType="go"
            style={styles.input}
            accessibilityLabel={mode === 'forgot' ? 'New password' : 'Password'}
          />
        </View>

        {mode === 'register' && answerField}

        <View style={styles.row}>
          <Check label="Remember me" value={remember} onChange={setRemember} />
          {mode === 'login' && (
            <Pressable accessibilityRole="button" onPress={() => switchMode('forgot')}>
              <Text style={styles.textBtn}>Forgot password?</Text>
            </Pressable>
          )}
        </View>

        <Btn label={busy ? 'One moment…' : SUBMIT[mode]} variant="ink" height={50} full disabled={busy} onPress={submit} />
        <Text style={styles.msg} accessibilityLiveRegion="polite">{msg ?? ''}</Text>

        {mode === 'forgot' ? (
          <Text style={styles.or}>
            Remembered it?{' '}
            <Text style={styles.textBtn} accessibilityRole="button" onPress={() => switchMode('login')}>Back to sign in</Text>
          </Text>
        ) : (
          <Text style={styles.or}>
            {mode === 'login' ? 'New here? ' : 'Already have an account? '}
            <Text style={styles.textBtn} accessibilityRole="button" onPress={() => switchMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </Text>
          </Text>
        )}
        <Muted small style={{ textAlign: 'center' }}>Your profile is only saved to your account when you choose to save it.</Muted>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  close: { alignItems: 'flex-end' },
  card: { gap: 20, paddingVertical: 38, paddingHorizontal: 24, borderRadius: 44, backgroundColor: C.surface, boxShadow: `16px 16px 34px rgba(160,163,178,0.5), -14px -14px 30px rgba(255,255,255,0.9)` },
  h1: { fontFamily: F.head, fontSize: 24, textAlign: 'center', color: C.ink2 },
  label: { fontFamily: F.head, fontSize: 17, color: C.ink3, marginBottom: 10 },
  input: { height: 46, paddingRight: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  textBtn: { fontFamily: F.body, fontSize: 15, color: C.dusk, textDecorationLine: 'underline' },
  msg: { textAlign: 'center', fontFamily: F.body, fontSize: 14, color: C.dusk, minHeight: 20 },
  or: { textAlign: 'center', fontFamily: F.body, fontSize: 17, color: C.ink3 },
});
